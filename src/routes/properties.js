import { Router } from "express";
import { listProperties } from "../data/properties/airtable.js";

const router = Router();

/**
 * GET /properties
 * Query (optional, for debug/diagnosis):
 *   ?debug=1                 -> include meta (baseId, view, filterByFormula, counts)
 *   ?view=<View Name>        -> override Airtable view name for this request only
 *   ?bypassEmail=1           -> ignore the app_email filter (list all rows in view)
 *   ?email=<someone@x.com>   -> force filter to this email instead of JWT email
 */
router.get("/", async (req, res) => {
  try {
    const debug = req.query.debug === "1";
    const viewOverride = req.query.view || undefined;
    const bypassEmail = req.query.bypassEmail === "1";
    const emailOverride = req.query.email || undefined;

    const result = await listProperties({
      user: req.user,
      debug,
      viewOverride,
      bypassEmail,
      emailOverride,
    });

    res.json(debug ? result : { items: result.items });
  } catch (err) {
    console.error("GET /properties failed:", err);
    res.status(500).json({ error: err?.message || "Failed to fetch properties" });
  }
});

export default router;
