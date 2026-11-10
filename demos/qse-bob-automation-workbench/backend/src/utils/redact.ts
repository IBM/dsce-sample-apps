/**
 * Central secret redaction. Every string that can reach a log, an execution log
 * line or an API error should pass through `redact()`.
 */
const PATTERNS: Array<[RegExp, string]> = [
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]'],
  [/(\bBearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[REDACTED]'],
  [/(\bBasic\s+)[A-Za-z0-9+/=]{8,}/gi, '$1[REDACTED]'],
  [/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@'],
  [/(\bauthorization["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1[REDACTED]'],
  [/(\bx-access-token:)[^\s@]+/gi, '$1[REDACTED]'],
  [/(\b(?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^\s"',}]{6,}/gi, '$1[REDACTED]']
];

class Redactor {
  private readonly secrets = new Set<string>();

  register(secret: string | undefined | null): void {
    if (secret && secret.length >= 6) this.secrets.add(secret);
  }

  unregister(secret: string | undefined | null): void {
    if (secret) this.secrets.delete(secret);
  }

  redact(input: string): string {
    let out = input;
    for (const secret of this.secrets) {
      if (out.includes(secret)) out = out.split(secret).join('[REDACTED]');
    }
    for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
    return out;
  }
}

export const redactor = new Redactor();
export const redact = (input: string): string => redactor.redact(input);
