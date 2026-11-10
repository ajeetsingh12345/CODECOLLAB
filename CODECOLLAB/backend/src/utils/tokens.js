import jwt from "jsonwebtoken";
import crypto from "crypto";

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m"
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: "refresh", jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"
  });
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
