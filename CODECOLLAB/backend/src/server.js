import "dotenv/config";
import http from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./app.js";
import { prisma } from "./config/prisma.js";
import { canEditSnippet, isSnippetChangePayload } from "./utils/collaboration.js";

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    socket.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch { next(new Error("Invalid socket token")); }
});

io.on("connection", socket => {
  socket.on("snippet:join", async payload => {
    const snippetId = payload?.snippetId;
    if (typeof snippetId !== "string" || !snippetId) return;
    try {
      const snippet = await prisma.snippet.findUnique({ where: { id: snippetId }, include: { permissions: true } });
      const allowed = snippet && (snippet.ownerId === socket.user.sub || snippet.visibility !== "PRIVATE" || snippet.permissions.some(p => p.userId === socket.user.sub));
      if (!allowed) return socket.emit("snippet:error", { message: "Access denied" });
      const room = `snippet:${snippetId}`;
      await socket.join(room);
      socket.to(room).emit("presence:joined", { userId: socket.user.sub, socketId: socket.id });
      socket.emit("snippet:joined", { snippetId });
    } catch (error) {
      console.error("Unable to join snippet room:", error);
      socket.emit("snippet:error", { message: "Unable to join snippet room" });
    }
  });
  socket.on("snippet:change", async payload => {
    if (!isSnippetChangePayload(payload)) return;
    const { snippetId, content } = payload;
    const room = `snippet:${snippetId}`;
    if (!socket.rooms.has(room)) return socket.emit("snippet:error", { message: "Join the snippet room before sending changes" });
    try {
      const snippet = await prisma.snippet.findUnique({ where: { id: snippetId }, include: { permissions: true } });
      if (!canEditSnippet(snippet, socket.user.sub))
        return socket.emit("snippet:error", { message: "Edit permission required" });
      socket.to(room).emit("snippet:change", { content, userId: socket.user.sub });
    } catch (error) {
      console.error("Unable to broadcast snippet change:", error);
      socket.emit("snippet:error", { message: "Unable to broadcast snippet change" });
    }
  });
  socket.on("disconnect", () => {
    for (const room of socket.rooms) {
      if (room.startsWith("snippet:")) socket.to(room).emit("presence:left", { userId: socket.user.sub });
    }
  });
});

const port = Number(process.env.PORT || 5000);
await prisma.$connect();
server.listen(port, () => console.log(`CodeCollab API listening on :${port}`));

process.on("SIGTERM", async () => {
  server.close();
  await prisma.$disconnect();
});
