require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./auth");

const app = express();

// ✅ Allow a comma-separated list of origins from env
const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

console.log("Allowed origins:", allowed);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl/Postman/no-origin
    const ok = allowed.some(a =>
      a === origin ||
      (a.endsWith("*") && origin.startsWith(a.slice(0, -1)))
    );
    return cb(ok ? null : new Error("Not allowed by CORS"), ok);
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.options("*", cors()); // preflight

app.use(express.json());

app.get("/health", (req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

app.get("/secure", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
