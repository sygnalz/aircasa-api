// aircasa-api/app.js
import express from "express";
import cors from "cors";
import propertiesRouter from "./src/routes/properties.js";
import { requireAuth } from "./src/middleware/auth.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGINS?.split(",") || [] }));
app.use(express.json());

// Basic health + auth sanity check
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/secure", requireAuth, (req, res) => res.json({ user: req.user }));

// Mount protected /properties
app.use("/properties", requireAuth, propertiesRouter);

export default app;
