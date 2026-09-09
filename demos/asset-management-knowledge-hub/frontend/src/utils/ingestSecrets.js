/**
 * In-memory secrets store for ingestion credentials.
 *
 * Credentials (S3 keys, Box tokens) must NEVER be written to localStorage,
 * cookies, or any other persistent browser storage. This module holds them in
 * a plain JS object that lives only in memory for the duration of the page
 * session and is gone on refresh.
 *
 * Usage:
 *   import { getSecrets, setSecrets } from '../utils/ingestSecrets';
 *
 *   // In Configuration (write):
 *   setSecrets('s3', { accessKey: '…', secretKey: '…' });
 *
 *   // In DataIngestion (read):
 *   const { accessKey, secretKey } = getSecrets('s3');
 */

const _secrets = {
  s3:        { accessKey: '', secretKey: '' },
  box:       { clientId: '', clientSecret: '', accessToken: '' },
  confluent: { apiKey: '', apiSecret: '' },
};

/**
 * Return a shallow copy of the stored secrets for a given source.
 * @param {'s3'|'box'} source
 */
export function getSecrets(source) {
  return { ...(_secrets[source] || {}) };
}

/**
 * Merge a patch into the stored secrets for a given source.
 * @param {'s3'|'box'} source
 * @param {object} patch
 */
export function setSecrets(source, patch) {
  _secrets[source] = { ...(_secrets[source] || {}), ...patch };
}

/**
 * Return defaults (all empty strings) — used to seed React state.
 */
export function defaultSecrets() {
  return {
    s3:        { accessKey: '', secretKey: '' },
    box:       { clientId: '', clientSecret: '', accessToken: '' },
    confluent: { apiKey: '', apiSecret: '' },
  };
}
