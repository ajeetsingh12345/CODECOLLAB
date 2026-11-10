import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/auth.routes.js";
import snippetRoutes from "./routes/snippet.routes.js";
import miscRoutes from "./routes/misc.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true, maxAge: 600 }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/", (req, res) => res.json({
  success: true,
  service: "CodeCollab API",
  status: "running",
  endpoints: {
    health: "/api/health",
    documentation: "/api/docs"
  }
}));
app.get("/api/health", (req, res) => res.json({ success: true, service: "CodeCollab API", status: "healthy", time: new Date().toISOString() }));
app.get("/api/docs.json", (req, res) => res.json({
  openapi: "3.0.0", info: { title: "CodeCollab API", version: "1.0.0" },
  servers: [{ url: "http://localhost:5000" }],
  paths: {
    "/api/auth/register": { post: { summary: "Register account" } },
    "/api/auth/login": { post: { summary: "Login" } },
    "/api/snippets": { get: { summary: "List snippets" }, post: { summary: "Create snippet" } },
    "/api/snippets/{id}": { get: { summary: "Get snippet" }, put: { summary: "Update snippet" }, delete: { summary: "Delete snippet" } }
  }
}));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(null, { swaggerUrl: "/api/docs.json" }));
app.use("/api/auth", authRoutes);
app.use("/api/snippets", snippetRoutes);
app.use("/api", miscRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
