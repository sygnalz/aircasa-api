import express from "express";
import cors from "cors";
import propertiesRouter from "./routes/properties.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGINS?.split(",") ?? true, credentials: true }));
app.use(express.json());

app.get("/healthz", (req, res) => res.json({ ok: true }));

// Protected routes
app.use("/properties", requireAuth, propertiesRouter);
app.get("/secure", requireAuth, (req, res) => res.json({ user: req.user }));

export default app;
