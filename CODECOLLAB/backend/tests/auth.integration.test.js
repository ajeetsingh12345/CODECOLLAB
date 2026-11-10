import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { cleanupTestUsers, createTestUser } from "./helpers.js";

describe("authentication flow", () => {
  const users = [];

  afterEach(async () => {
    await cleanupTestUsers(users.splice(0));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("registers, logs in, restores, and revokes a session", async () => {
    const agent = request.agent(app);
    const email = `integration-${randomUUID()}@example.invalid`;
    const password = "Test-Password-123!";
    const registration = await agent.post("/api/auth/register").send({
      name: "Auth Flow",
      email,
      password
    });

    expect(registration.status).toBe(201);
    expect(registration.body.accessToken).toBeTruthy();
    users.push({ email });

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user.passwordHash).not.toBe(password);

    const unauthenticated = await request(app).get("/api/auth/me");
    expect(unauthenticated.status).toBe(401);

    const login = await agent.post("/api/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(email);

    const restored = await agent.post("/api/auth/refresh");
    expect(restored.status).toBe(200);
    expect(restored.body.user).toMatchObject({ name: "Auth Flow", email });
    const profile = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${restored.body.accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe(email);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    const afterLogout = await agent.post("/api/auth/refresh");
    expect(afterLogout.status).toBe(401);
  });

  test("updates the authenticated user's profile", async () => {
    const user = await createTestUser();
    users.push(user);
    const headers = { Authorization: `Bearer ${user.accessToken}` };
    const response = await request(app)
      .patch("/api/auth/me")
      .set(headers)
      .send({ name: "Updated Name", bio: "Collaborator", avatarUrl: "" });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      name: "Updated Name",
      bio: "Collaborator",
      avatarUrl: null
    });
  });

  test("returns an actionable redirect when Google OAuth is not configured", async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    try {
      const response = await request(app).get("/api/auth/google");
      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("oauthError=google-not-configured");
    } finally {
      if (clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = clientId;
      if (clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = clientSecret;
    }
  });

  test("starts Google OAuth with the configured callback and OpenID scopes", async () => {
    const previous = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL
    };
    process.env.GOOGLE_CLIENT_ID = "test-google-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    process.env.GOOGLE_CALLBACK_URL = "http://localhost:5000/api/auth/google/callback";

    try {
      const response = await request.agent(app).get("/api/auth/google");
      const redirect = new URL(response.headers.location);
      expect(response.status).toBe(302);
      expect(redirect.origin).toBe("https://accounts.google.com");
      expect(redirect.searchParams.get("client_id")).toBe("test-google-client");
      expect(redirect.searchParams.get("redirect_uri")).toBe("http://localhost:5000/api/auth/google/callback");
      expect(redirect.searchParams.get("response_type")).toBe("code");
      expect(redirect.searchParams.get("scope")).toBe("openid email profile");
      expect(redirect.searchParams.get("state")).toBeTruthy();
      expect(response.headers["set-cookie"].some(cookie => cookie.includes("googleOAuthState="))).toBe(true);
    } finally {
      if (previous.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previous.clientSecret;
      if (previous.callbackUrl === undefined) delete process.env.GOOGLE_CALLBACK_URL;
      else process.env.GOOGLE_CALLBACK_URL = previous.callbackUrl;
    }
  });

  test("rejects a Google callback without a matching state cookie", async () => {
    const response = await request(app).get("/api/auth/google/callback?code=not-used&state=invalid");
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("oauthError=google-invalid-state");
  });
});
