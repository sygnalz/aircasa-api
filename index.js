// index.js
// AirCasa API (Express + CORS + Supabase JWT verification, robust wildcard CORS)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();

// ---------- Config ----------
const PORT = process.env.PORT || 10000;

// Comma-separated list of allowed origins (CORS_ORIGINS in Render)
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Fallbacks (safe defaults)
const defaultOrigins = [
  'https://aircasa-app.vercel.app',
  'https://aircasa-app-*.vercel.app',   // previews for project "aircasa-app"
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
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const originMatchers = ORIGINS.map(pat => {
  if (pat.includes('*')) return { type: 'wild', re: wildcardToRegExp(pat), pat };
  return { type: 'exact', val: pat };
});

function originAllowed(origin) {
  if (!origin) return true; // allow non-browser clients (no Origin)
  for (const m of originMatchers) {
    if (m.type === 'exact' && origin === m.val) return true;
    if (m.type === 'wild' && m.re.test(origin)) return true;
  }
  return false;
}

// ---------- CORS (preflight-friendly) ----------
const corsOptions = {
  origin(origin, cb) {
    const ok = originAllowed(origin);
    if (ok) return cb(null, true);
    return cb(new Error(`CORS blocked. Origin "${origin}" is not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // explicit preflight

// JSON parsing
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
      user: {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      },
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
  console.log('Allowed origins:', ORIGINS);
  console.log(`Token alg: HS256  Secret len: ${SUPABASE_JWT_SECRET ? SUPABASE_JWT_SECRET.length : 0}`);
});
