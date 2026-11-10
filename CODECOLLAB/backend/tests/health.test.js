import request from "supertest";
import { jest } from "@jest/globals";
import app from "../src/app.js";

describe("health endpoint", () => {
  test("root route describes the API", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      service: "CodeCollab API",
      status: "running",
      endpoints: {
        health: "/api/health",
        documentation: "/api/docs"
      }
    });
  });

  test("returns healthy status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("healthy");
  });

  test("caches CORS preflight responses", async () => {
    const response = await request(app)
      .options("/api/auth/logout")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-max-age"]).toBe("600");
  });

  test("returns a validation error for invalid registration data", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "short"
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid request data");
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "name" }),
      expect.objectContaining({ path: "email" }),
      expect.objectContaining({ path: "password" })
    ]));
  });

  test("returns a validation error for missing login data", async () => {
    const response = await request(app).post("/api/auth/login").send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid request data");
  });

  test("returns 404 for an unknown route", async () => {
    const response = await request(app).get("/api/not-a-route");
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Route not found");

    const unknownSnippetRoute = await request(app).get("/api/snippets/not-a-route/unknown");
    expect(unknownSnippetRoute.status).toBe(404);
    expect(unknownSnippetRoute.body.message).toBe("Route not found");
  });
});
