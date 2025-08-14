// index.js
// AirCasa API (Express 4 + robust CORS + Supabase HS256 JWT verify)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

// >>> NEW: import the Airtable-backed /properties router
import propertiesRouter from './src/routes/properties.js';

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

// ---------- Auth helpers ----------
function extractBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function verifySupabaseJwt(req, res) {
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
  } catch (_err) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

// Tiny middleware that sets req.user or ends the request
function authMiddleware(req, res, next) {
  const decoded = verifySupabaseJwt(req, res);
  if (!decoded) return; // response already sent
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role || 'authenticated',
    aud: decoded.aud,
    iss: decoded.iss,
  };
  next();
}

// ---------- Secure endpoints ----------
app.get('/secure', authMiddleware, (req, res) => {
  return res.json({
    ok: true,
    message: 'Authenticated request succeeded',
    user: req.user,
  });
});

app.get('/me', authMiddleware, (req, res) => {
  return res.json({
    ok: true,
    user: req.user,
  });
});

// ---------- /properties (Airtable-backed) ----------
// NOTE: removed the old mock handler. We now mount the real router behind auth.
app.use('/properties', authMiddleware, propertiesRouter);

// ---------- Startup ----------
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log('Allowed origins (patterns):', ORIGINS);
  console.log(`Token alg: HS256  Secret len: ${SUPABASE_JWT_SECRET ? SUPABASE_JWT_SECRET.length : 0}`);
});
