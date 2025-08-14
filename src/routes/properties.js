// aircasa-api/src/routes/properties.js
import { Router } from "express";
import { listProperties } from "../data/properties/airtable.js";

const router = Router();

/**
 * GET /properties (protected)
 * Returns: { items: [...] }
 */
router.get("/", async (req, res) => {
  try {
    const items = await listProperties({ user: req.user });
    res.json({ items });
  } catch (err) {
    console.error("GET /properties failed:", err);
    res.status(500).json({ error: err?.message || "Failed to fetch properties" });
  }
});

export default router;
