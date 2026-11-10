import jwt from "jsonwebtoken";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ message: "Admin access required" });
  next();
}
