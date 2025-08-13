// index.js
// AirCasa API (Express + CORS + Supabase JWT verification)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

const app = express();

// ---------- Config ----------
const PORT = process.env.PORT || 10000;

// Comma-separated list of allowed origins, e.g.:
// CORS_ORIGINS=https://aircasa-app.vercel.app,http://localhost:3000
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Fallbacks (kept conservative)
const DEFAULT_ORIGINS = [
  'https://aircasa-app.vercel.app',
  'http://localhost:3000',
];

const ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;

// Supabase Legacy JWT Secret (HS256)
const SUPABASE_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ||
  process.env.JWT_SECRET || // in case you named it this way earlier
  '';

// ---------- CORS ----------
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser tools (curl/Postman) which send no Origin
      if (!origin) return cb(null, true);

      const ok = ORIGINS.includes(origin);
      if (ok) return cb(null, true);

      return cb(
        new Error(
          `CORS blocked. Origin "${origin}" is not in allowed list: ${ORIGINS.join(
            ', '
          )}`
        )
      );
    },
    credentials: true,
  })
);

// For JSON bodies if you add POST endpoints later
app.use(express.json());

// ---------- Health ----------
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'aircasa-api', ts: Date.now() });
});

// ---------- Auth helper ----------
function extractBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// ---------- Secure endpoint ----------
app.get('/secure', (req, res) => {
  try {
    if (!SUPABASE_JWT_SECRET) {
      return res
        .status(500)
        .json({ error: 'Server missing SUPABASE_JWT_SECRET' });
    }

    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Missing token' });

    // Verify HS256 token from Supabase (Legacy JWT Secret)
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // If verify succeeds, you can trust "decoded" (contains sub, email, etc.)
    return res.json({
      ok: true,
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
  console.log(
    `Token alg: HS256  Secret len: ${SUPABASE_JWT_SECRET ? SUPABASE_JWT_SECRET.length : 0}`
  );
});
