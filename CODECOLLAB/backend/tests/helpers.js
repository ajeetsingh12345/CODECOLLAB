import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

export async function createTestUser() {
  const email = `integration-${randomUUID()}@example.invalid`;
  const response = await request(app).post("/api/auth/register").send({
    name: "Integration Test",
    email,
    password: "Test-Password-123!"
  });

  if (response.status !== 201) {
    throw new Error(`Test user registration failed with ${response.status}: ${response.text}`);
  }

  return { ...response.body, email };
}

export async function cleanupTestUsers(users) {
  const emails = users.map(user => user.email).filter(Boolean);
  if (emails.length) await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
