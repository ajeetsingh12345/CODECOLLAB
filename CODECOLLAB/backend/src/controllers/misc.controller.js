import { prisma } from "../config/prisma.js";

export async function activities(req, res, next) {
  try {
    const items = await prisma.activity.findMany({
      where: { OR: [{ userId: req.user.sub }, { snippet: { ownerId: req.user.sub } }] },
      include: { user: { select: { id: true, name: true } }, snippet: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" }, take: 50
    });
    res.json({ items });
  } catch (e) { next(e); }
}

export async function notifications(req, res, next) {
  try {
    const items = await prisma.notification.findMany({ where: { userId: req.user.sub }, orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ items });
  } catch (e) { next(e); }
}

export async function markNotificationRead(req, res, next) {
  try {
    const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.sub }, data: { isRead: true } });
    res.json({ updated: result.count });
  } catch (e) { next(e); }
}
