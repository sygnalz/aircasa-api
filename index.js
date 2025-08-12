require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./auth");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Protected test route
app.get("/secure", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
