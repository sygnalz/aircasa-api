// aircasa-api/src/middleware/auth.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing Authorization header" });

  try {
    const secret = process.env.SUPABASE_JWT_SECRET;
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
