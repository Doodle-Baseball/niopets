const crypto = require('crypto');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function credentialsConfigured() {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && ADMIN_TOKEN);
}

function verifyCredentials(email, password) {
  if (!credentialsConfigured()) return false;
  const normalized = String(email || '').trim().toLowerCase();
  return (
    timingSafeEqualString(normalized, ADMIN_EMAIL) &&
    timingSafeEqualString(String(password || ''), ADMIN_PASSWORD)
  );
}

function isAuthorizedRequest(request) {
  if (!ADMIN_TOKEN) return false;
  const header = request.headers.get('x-admin-token');
  return typeof header === 'string' && header.length > 0 && timingSafeEqualString(header, ADMIN_TOKEN);
}

module.exports = {
  ADMIN_TOKEN,
  credentialsConfigured,
  verifyCredentials,
  isAuthorizedRequest,
};
