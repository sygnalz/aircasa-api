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
    if (ok) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// JSON body
app.use(express.json());

// ---------- Health ----------
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'aircasa-api', ts: Date.now() });
});

// ---------- Helpers (auth) ----------
function extractBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
function requireSupabaseUser(req, res) {
  if (!SUPABASE_JWT_SECRET) {
    res.status(500).json({ error: 'Server missing SUPABASE_JWT_SECRET' });
    return null;
  }
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return null;
  }
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });
    return decoded; // contains sub, email, role, aud, iss
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

// ---------- Secure endpoints ----------
app.get('/secure', (req, res) => {
  const decoded = requireSupabaseUser(req, res);
  if (!decoded) return;

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
});

app.get('/me', (req, res) => {
  const decoded = requireSupabaseUser(req, res);
  if (!decoded) return;

  return res.json({
    ok: true,
    user: {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role || 'authenticated',
    },
  });
});

// ---------- New: /properties (mock) ----------
app.get('/properties', (req, res) => {
  const decoded = requireSupabaseUser(req, res);
  if (!decoded) return;

  // TODO: replace with real data source (Airtable/Supabase DB)
  const items = [
    { id: 'prop_001', address: '123 Main St', city: 'Austin', state: 'TX', price: 525000, status: 'active' },
    { id: 'prop_002', address: '45 Market Ave', city: 'Miami', state: 'FL', price: 749000, status: 'pending' },
  ];

  res.json({ ok: true, items });
});

// ---------- Startup ----------
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log('Allowed origins (patterns):', ORIGINS);
  console.log(`Token alg: HS256  Secret len: ${SUPABASE_JWT_SECRET ? SUPABASE_JWT_SECRET.length : 0}`);
});
