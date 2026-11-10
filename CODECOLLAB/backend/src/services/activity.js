import { prisma } from "../config/prisma.js";

export async function recordActivity(userId, action, snippetId = null, detail = null) {
  return prisma.activity.create({ data: { userId, action, snippetId, detail } });
}

export async function notify(userId, type, message, link = null) {
  if (!userId) return null;
  const notification = await prisma.notification.create({ data: { userId, type, message, link } });
  console.log(`[mock-email] To user ${userId}: ${message}`);
  return notification;
}
