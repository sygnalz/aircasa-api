// index.js
// AirCasa API (Express 4 + robust CORS + Supabase HS256 JWT verify)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();

// ---------- Config ----------
const PORT = process.env.PORT || 10000;

// Comma-separated list of allowed origins (Render env: CORS_ORIGINS)
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Fallbacks
const defaultOrigins = [
  'https://aircasa-app.vercel.app',
  'https://*.vercel.app',      // covers any Vercel preview while we stabilize
  'http://localhost:3000',
];

const ORIGINS = envOrigins.length ? envOrigins : defaultOrigins;

// Supabase Legacy JWT Secret (HS256)
const SUPABASE_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ||
  process.env.JWT_SECRET ||
  '';

// ---------- Helpers ----------
function wildcardToRegExp(pattern) {
  // escape regex chars then replace '*' with '.*'
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const originMatchers = ORIGINS.map(pat =>
  pat.includes('*')
    ? { type: 'wild', re: wildcardToRegExp(pat), pat }
    : { type: 'exact', val: pat }
);

function originAllowed(origin) {
  if (!origin) return true; // allow curl/Postman (no Origin)
  for (const m of originMatchers) {
    if (m.type === 'exact' && origin === m.val) return true;
    if (m.type === 'wild' && m.re.test(origin)) return true;
  }
  return false;
}

// ---------- CORS ----------
const corsOptions = {
  origin(origin, cb) {
    const ok = originAllowed(origin);
    console.log('[CORS] Origin:', origin || '(none)', '→', ok ? 'ALLOWED' : 'BLOCKED');
    if (ok) return cb(null, true);
    // Do not throw; respond as blocked (preflight will fail) but keep logs readable
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  optionsSuccessStatus: 204,
};
// Apply CORS early + explicit preflight
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// JSON body
app.use(express.json());

// ---------- Health ----------
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'aircasa-api', ts: Date.now() });
});

// ---------- Secure endpoint (HS256) ----------
function extractBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

app.get('/secure', (req, res) => {
  try {
    if (!SUPABASE_JWT_SECRET) {
      return res.status(500).json({ error: 'Server missing SUPABASE_JWT_SECRET' });
    }
    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });

    return res.json({
      ok: true,
      message: 'Authenticated request succeeded',
      user: { id: decoded.sub, email: decoded.email, role: decoded.role },
      iss: decoded.iss,
      aud: decoded.aud,
    });
  } catch (err) {
    console.error('JWT verify error:', err?.message || err);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// ---------- Startup ----------
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log('Allowed origins (patterns):', ORIGINS);
  console.log(`Token alg: HS256  Secret len: ${SUPABASE_JWT_SECRET ? SUPABASE_JWT_SECRET.length : 0}`);
});

// ...existing imports, CORS, /healthz, /secure, etc. stay above

// --- New: /me returns the Supabase user from the Bearer token ---
app.get('/me', (req, res) => {
  try {
    if (!SUPABASE_JWT_SECRET) {
      return res.status(500).json({ error: 'Server missing SUPABASE_JWT_SECRET' });
    }
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
    const token = auth.slice(7);

    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });

    // shape as our canonical "user" payload
    return res.json({
      ok: true,
      user: {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role || 'authenticated'
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});
