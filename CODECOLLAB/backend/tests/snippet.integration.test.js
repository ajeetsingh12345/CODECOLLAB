import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { cleanupTestUsers, createTestUser } from "./helpers.js";

describe("snippet lifecycle", () => {
  const users = [];

  afterEach(async () => {
    await cleanupTestUsers(users.splice(0));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("creates, versions, restores, and deletes a snippet", async () => {
    const owner = await createTestUser();
    users.push(owner);
    const headers = { Authorization: `Bearer ${owner.accessToken}` };

    const created = await request(app).post("/api/snippets").set(headers).send({
      title: "Lifecycle snippet",
      content: "const value = 1;",
      language: "javascript",
      visibility: "PRIVATE",
      tags: ["Review", "review"]
    });
    expect(created.status).toBe(201);
    const snippetId = created.body.snippet.id;

    const detail = await request(app).get(`/api/snippets/${snippetId}`).set(headers);
    expect(detail.status).toBe(200);
    expect(detail.body.snippet.tags).toHaveLength(1);

    const updated = await request(app).put(`/api/snippets/${snippetId}`).set(headers).send({
      content: "const value = 2;",
      tags: []
    });
    expect(updated.status).toBe(200);
    expect(updated.body.snippet.content).toBe("const value = 2;");

    const versions = await request(app).get(`/api/snippets/${snippetId}/versions`).set(headers);
    expect(versions.status).toBe(200);
    expect(versions.body.items).toHaveLength(2);
    expect(versions.body.items[1].content).toBe("const value = 1;");

    const restored = await request(app)
      .post(`/api/snippets/${snippetId}/versions/${versions.body.items[1].id}/restore`)
      .set(headers);
    expect(restored.status).toBe(200);
    expect(restored.body.snippet.content).toBe("const value = 1;");

    const deleted = await request(app).delete(`/api/snippets/${snippetId}`).set(headers);
    expect(deleted.status).toBe(200);
    const missing = await request(app).get(`/api/snippets/${snippetId}`).set(headers);
    expect(missing.status).toBe(404);
  });
});
