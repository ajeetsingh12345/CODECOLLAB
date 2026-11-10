import { randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { hashToken, signAccessToken, signRefreshToken } from "../utils/tokens.js";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128)
});
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(500).nullable(),
  avatarUrl: z.union([z.string().url().max(2048), z.literal(""), z.null()])
});
const profileSelect = {
  id: true,
  name: true,
  email: true,
  bio: true,
  avatarUrl: true,
  role: true,
  createdAt: true
};
const googleStateCookie = "googleOAuthState";
const refreshUserSelect = profileSelect;

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function loginRedirect(res, error) {
  const url = new URL("/login", process.env.CLIENT_URL || "http://localhost:3000");
  if (error) url.searchParams.set("oauthError", error);
  return res.redirect(url.toString());
}

function googleCallbackUrl() {
  return process.env.GOOGLE_CALLBACK_URL ||
    (process.env.BACKEND_URL || "http://localhost:" + (process.env.PORT || 5000)) + "/api/auth/google/callback";
}

export function startGoogleOAuth(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return loginRedirect(res, "google-not-configured");
  }

  const state = randomBytes(32).toString("hex");
  res.cookie(googleStateCookie, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback",
    maxAge: 10 * 60 * 1000
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", googleCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  return res.redirect(url.toString());
}

export async function finishGoogleOAuth(req, res) {
  const suppliedState = req.query.state;
  const expectedState = req.cookies[googleStateCookie];
  res.clearCookie(googleStateCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback"
  });

  if (req.query.error) return loginRedirect(res, "google-denied");
  if (typeof suppliedState !== "string" || typeof expectedState !== "string") {
    return loginRedirect(res, "google-invalid-state");
  }
  const supplied = Buffer.from(suppliedState);
  const expected = Buffer.from(expectedState);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return loginRedirect(res, "google-invalid-state");
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || typeof req.query.code !== "string") {
    return loginRedirect(res, "google-unavailable");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: req.query.code,
        grant_type: "authorization_code",
        redirect_uri: googleCallbackUrl()
      })
    });
    const tokenResult = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenResult.access_token !== "string") {
      throw new Error("Google token exchange failed");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + tokenResult.access_token }
    });
    if (!profileResponse.ok) throw new Error("Google profile lookup failed");
    const googleUser = await profileResponse.json();
    if (!googleUser.sub || !googleUser.email || googleUser.email_verified !== true) {
      return loginRedirect(res, "google-verified-email-required");
    }

    const email = googleUser.email.toLowerCase();
    const user = await prisma.$transaction(async tx => {
      const linkedAccount = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: String(googleUser.sub)
          }
        },
        include: { user: { select: profileSelect } }
      });
      if (linkedAccount) return linkedAccount.user;

      const existingUser = await tx.user.findUnique({ where: { email } });
      const accountUser = existingUser || await tx.user.create({
        data: {
          name: typeof googleUser.name === "string" && googleUser.name.trim()
            ? googleUser.name.trim().slice(0, 80)
            : email.slice(0, 80),
          email,
          passwordHash: null,
          avatarUrl: typeof googleUser.picture === "string" ? googleUser.picture.slice(0, 2048) : null
        },
        select: profileSelect
      });
      await tx.oAuthAccount.create({
        data: {
          provider: "google",
          providerAccountId: String(googleUser.sub),
          userId: accountUser.id
        }
      });
      return accountUser;
    });

    const refreshToken = signRefreshToken(user);
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 86400000)
      }
    });
    setRefreshCookie(res, refreshToken);
    return res.redirect(new URL("/auth/google/callback", process.env.CLIENT_URL || "http://localhost:3000").toString());
  } catch (error) {
    console.error("Google OAuth sign-in failed:", error);
    return loginRedirect(res, "google-unavailable");
  }
}

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (exists) return res.status(409).json({ message: "Email is already registered" });
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(data.password, 12) },
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await prisma.refreshToken.create({
      data: { tokenHash: hashToken(refreshToken), userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) }
    });
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  } catch (e) { next(e); }
}

export async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ message: "Invalid email or password" });
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await prisma.refreshToken.create({
      data: { tokenHash: hashToken(refreshToken), userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) }
    });
    setRefreshCookie(res, refreshToken);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken });
  } catch (e) { next(e); }
}

export async function refresh(req, res) {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "Refresh token missing" });
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: refreshUserSelect } }
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new Error("Invalid refresh token");
    const revoked = await prisma.refreshToken.updateMany({
      where: { id: stored.id, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() }
    });
    if (revoked.count !== 1) throw new Error("Invalid refresh token");
    const user = stored.user;
    const nextRefresh = signRefreshToken(user);
    await prisma.refreshToken.create({ data: { tokenHash: hashToken(nextRefresh), userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) } });
    setRefreshCookie(res, nextRefresh);
    res.json({ user, accessToken: signAccessToken(user) });
  } catch {
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function logout(req, res) {
  const token = req.cookies.refreshToken;
  if (token) await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.json({ message: "Logged out" });
}

export async function profile(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: profileSelect
  });
  res.json({ user });
}

export async function updateProfile(req, res, next) {
  try {
    const data = profileSchema.partial().parse(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Provide at least one profile field to update" });
    }
    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: {
        ...data,
        avatarUrl: data.avatarUrl === "" ? null : data.avatarUrl
      },
      select: profileSelect
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
