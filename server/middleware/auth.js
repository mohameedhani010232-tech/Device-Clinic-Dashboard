const crypto = require('crypto');

function getSecret() {
  const secret = String(process.env.APP_SESSION_SECRET || '').trim();
  if (secret.length < 32) {
    throw new Error('APP_SESSION_SECRET must be at least 32 characters');
  }
  return secret;
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch (_) { return null; }
  if (!payload || payload.exp < Date.now()) return null;
  return payload;
}

function createSession() {
  const hours = Math.max(Number(process.env.SESSION_HOURS || 12), 1);
  return sign({ iat: Date.now(), exp: Date.now() + hours * 60 * 60 * 1000 });
}

function getBearerToken(req) {
  const header = String(req.get('Authorization') || '');
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

function requireAuth(req, res, next) {
  try {
    const payload = verify(getBearerToken(req));
    if (!payload) return res.status(401).json({ success: false, message: 'انتهت جلسة الدخول أو لم يتم تسجيل الدخول.' });
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
}

function login(req, res) {
  const configuredPassword = String(process.env.APP_PASSWORD || '').trim();
  if (!configuredPassword) {
    return res.status(503).json({ success: false, message: 'APP_PASSWORD غير مضبوط على الخادم.' });
  }
  const supplied = String(req.body?.password || '').trim();
  const a = Buffer.from(supplied);
  const b = Buffer.from(configuredPassword);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return res.status(401).json({ success: false, message: 'رقم الدخول غير صحيح.' });
  res.json({ success: true, token: createSession(), expiresInHours: Math.max(Number(process.env.SESSION_HOURS || 12), 1) });
}

module.exports = { requireAuth, login };
