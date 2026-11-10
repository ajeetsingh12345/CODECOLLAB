import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { cleanupTestUsers, createTestUser } from "./helpers.js";

describe("snippet collaboration and review", () => {
  const users = [];

  afterEach(async () => {
    await cleanupTestUsers(users.splice(0));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("enforces roles while sharing a snippet and resolving a comment", async () => {
    const owner = await createTestUser();
    const editor = await createTestUser();
    const viewer = await createTestUser();
    users.push(owner, editor, viewer);
    const ownerHeaders = { Authorization: `Bearer ${owner.accessToken}` };
    const editorHeaders = { Authorization: `Bearer ${editor.accessToken}` };
    const viewerHeaders = { Authorization: `Bearer ${viewer.accessToken}` };

    const created = await request(app).post("/api/snippets").set(ownerHeaders).send({
      title: "Shared snippet",
      content: "review me",
      visibility: "PRIVATE"
    });
    expect(created.status).toBe(201);
    const snippetId = created.body.snippet.id;

    const editorShare = await request(app).post(`/api/snippets/${snippetId}/share`).set(ownerHeaders).send({
      email: editor.email,
      role: "EDITOR"
    });
    const viewerShare = await request(app).post(`/api/snippets/${snippetId}/share`).set(ownerHeaders).send({
      email: viewer.email,
      role: "VIEWER"
    });
    expect(editorShare.status).toBe(200);
    expect(viewerShare.status).toBe(200);

    const editorDashboard = await request(app).get("/api/snippets?shared=true").set(editorHeaders);
    expect(editorDashboard.status).toBe(200);
    expect(editorDashboard.body.items).toHaveLength(1);
    expect(editorDashboard.body.items[0]).toMatchObject({
      id: snippetId,
      owner: { name: "Integration Test" },
      permissions: [{ role: "EDITOR" }]
    });
    const viewerDashboard = await request(app).get("/api/snippets?shared=true").set(viewerHeaders);
    expect(viewerDashboard.status).toBe(200);
    expect(viewerDashboard.body.items[0].permissions).toEqual([{ role: "VIEWER" }]);

    const viewerRead = await request(app).get(`/api/snippets/${snippetId}`).set(viewerHeaders);
    expect(viewerRead.status).toBe(200);
    const viewerEdit = await request(app).put(`/api/snippets/${snippetId}`).set(viewerHeaders).send({
      content: "viewer must not edit"
    });
    expect(viewerEdit.status).toBe(403);

    const comment = await request(app).post(`/api/snippets/${snippetId}/comments`).set(viewerHeaders).send({
      body: "Please clarify this line",
      lineNumber: 1
    });
    expect(comment.status).toBe(201);

    const editorEdit = await request(app).put(`/api/snippets/${snippetId}`).set(editorHeaders).send({
      content: "editor update"
    });
    expect(editorEdit.status).toBe(200);
    const versions = await request(app).get(`/api/snippets/${snippetId}/versions`).set(ownerHeaders);
    expect(versions.status).toBe(200);
    expect(versions.body.items).toHaveLength(2);
    expect(versions.body.items[0].createdAt).toBeTruthy();

    const restored = await request(app)
      .post(`/api/snippets/${snippetId}/versions/${versions.body.items[1].id}/restore`)
      .set(ownerHeaders);
    expect(restored.status).toBe(200);
    expect(restored.body.snippet.content).toBe("review me");

    const resolved = await request(app)
      .patch(`/api/snippets/${snippetId}/comments/${comment.body.comment.id}/resolve`)
      .set(editorHeaders)
      .send({ resolved: true });
    expect(resolved.status).toBe(200);
    expect(resolved.body.comment.isResolved).toBe(true);

    const comments = await request(app).get(`/api/snippets/${snippetId}/comments`).set(ownerHeaders);
    expect(comments.body.comments[0].isResolved).toBe(true);
  });
});
