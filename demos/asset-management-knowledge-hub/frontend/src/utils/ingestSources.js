/**
 * Ingestion source config — localStorage persistence utilities.
 *
 * Kept in a separate module so Configuration.jsx only exports a React
 * component (required for Vite Fast Refresh to work correctly).
 *
 * SECURITY: credentials (accessKey, secretKey, clientSecret, accessToken)
 * are intentionally excluded from localStorage. Only non-secret config
 * (endpoint, bucket, region, prefix, category, folder IDs, URLs) is persisted.
 * Secrets live in React state only and are cleared on page refresh.
 */

const INGEST_SOURCES_KEY = 'mkh_ingestion_sources';
const INGEST_VERSION_KEY = 'mkh_ingestion_sources_version';
// Bump when the shape of the stored (non-secret) config changes.
// v7-no-prefix: default COS prefix changed from "documents/" to "" (scan whole bucket).
const INGEST_SOURCES_VERSION = 'v7-no-prefix';

// Non-secret defaults — safe to persist in localStorage.
function defaultIngestSources() {
  return {
    // IBM COS — IAM API key mode. configured is set server-side via /api/cos/status.
    cos: { prefix: '', configured: false },
    web: { urls: '', maxDepth: 1, maxPages: 20, selector: '', category: 'web-content', configured: false },
    box: { folderId: '0', category: 'box-document', configured: false },
    confluent: {
      bootstrapServers: '',
      securityProtocol: 'SASL_SSL',
      saslMechanism:    'PLAIN',
      topics:           '',
      groupId:          'maximo-knowledge-hub',
      category:         'event-stream',
      configured:       false,
    },
  };
}

export function loadIngestSources() {
  try {
    // If the stored version doesn't match, wipe the cache and reload defaults.
    if (localStorage.getItem(INGEST_VERSION_KEY) !== INGEST_SOURCES_VERSION) {
      localStorage.removeItem(INGEST_SOURCES_KEY);
      localStorage.setItem(INGEST_VERSION_KEY, INGEST_SOURCES_VERSION);
    }
    return JSON.parse(localStorage.getItem(INGEST_SOURCES_KEY) || 'null') || defaultIngestSources();
  } catch {
    return defaultIngestSources();
  }
}

/**
 * Persist non-secret source config to localStorage.
 * Secret fields are stripped before writing so they can never end up stored.
 */
export function saveIngestSources(sources) {
  const safe = {
    cos:      { ...sources.cos },
    web:      { ...sources.web },
    box:      { ...sources.box, clientId: undefined, clientSecret: undefined, accessToken: undefined },
    confluent: { ...sources.confluent },
  };
  localStorage.setItem(INGEST_SOURCES_KEY, JSON.stringify(safe));
}
