import dns from 'node:dns';
import net from 'node:net';
import { Agent } from 'undici';
import { AppError } from './errors.js';

export interface EndpointPolicy {
  allowedHosts: string[];
  allowPrivateNetwork: boolean;
}

type AddressClass = 'public' | 'private' | 'loopback' | 'blocked';

function ipv4Class(ip: string): AddressClass {
  const [a, b] = ip.split('.').map(Number);
  if (a === 0 || a >= 224) return 'blocked'; // unspecified, multicast, reserved, broadcast
  if (a === 169 && b === 254) return 'blocked'; // link-local incl. cloud metadata 169.254.169.254
  if (a === 127) return 'loopback';
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) {
    return 'private';
  }
  return 'public';
}

export function classifyAddress(ip: string): AddressClass {
  if (net.isIPv4(ip)) return ipv4Class(ip);
  const lower = ip.toLowerCase();
  if (lower === '::' || lower.startsWith('ff')) return 'blocked';
  if (lower === '::1') return 'loopback';
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return ipv4Class(mapped[1]);
  if (/^fe[89ab]/.test(lower)) return 'blocked'; // fe80::/10 link-local
  if (lower.startsWith('fd00:ec2')) return 'blocked'; // AWS IPv6 metadata
  if (/^f[cd]/.test(lower)) return 'private'; // fc00::/7 unique local
  return 'public';
}

/** Parses and statically validates an outbound endpoint URL. */
export function parseEndpoint(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new AppError(400, 'invalid_endpoint', 'Endpoint must be a valid http:// or https:// URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(400, 'invalid_endpoint', 'Endpoint must use http or https');
  }
  if (url.username || url.password) throw new AppError(400, 'invalid_endpoint', 'Endpoint must not contain credentials');
  if (url.search || url.hash) throw new AppError(400, 'invalid_endpoint', 'Endpoint must not contain a query string or fragment');
  return url;
}

function hostAllowed(host: string, policy: EndpointPolicy): boolean {
  return policy.allowedHosts.includes(host.toLowerCase());
}

export function assertHostAllowedByName(url: URL, policy: EndpointPolicy): void {
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  // IP literals never go through DNS, so the connect-time lookup guard cannot see them.
  if (net.isIP(host)) assertAddressAllowed(host, host, policy);
  if (policy.allowedHosts.length && !hostAllowed(host, policy)) {
    throw new AppError(
      400,
      'endpoint_not_allowed',
      `Host "${host}" is not in BOB_ALLOWED_HOSTS. Ask an administrator to allow-list it.`
    );
  }
}

/** Validates a resolved address against the SSRF policy. */
export function assertAddressAllowed(address: string, hostname: string, policy: EndpointPolicy): void {
  const cls = classifyAddress(address);
  if (cls === 'blocked') {
    throw new AppError(400, 'endpoint_not_allowed', 'Endpoint resolves to a blocked address range (link-local, metadata or reserved)');
  }
  if (cls === 'private' || cls === 'loopback') {
    if (!policy.allowPrivateNetwork && !hostAllowed(hostname, policy)) {
      throw new AppError(
        400,
        'endpoint_not_allowed',
        'Endpoint resolves to a private or loopback address. Add the host to BOB_ALLOWED_HOSTS or set BOB_ALLOW_PRIVATE_NETWORK=true.'
      );
    }
  }
}

/**
 * Undici dispatcher whose DNS lookup validates every resolved address at
 * connection time. This closes DNS-rebinding gaps between validation and use.
 */
export function createGuardedAgent(policy: EndpointPolicy, timeoutMs: number): Agent {
  return new Agent({
    connectTimeout: timeoutMs,
    headersTimeout: timeoutMs,
    bodyTimeout: 0,
    connect: {
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
          if (err) return callback(err, '', 4);
          try {
            const list = addresses as dns.LookupAddress[];
            for (const a of list) assertAddressAllowed(a.address, hostname.toLowerCase(), policy);
            if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
            return callback(null, list[0].address, list[0].family);
          } catch (e) {
            return callback(e as Error, '', 4);
          }
        });
      }
    }
  });
}
