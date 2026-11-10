import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { notify, recordActivity } from "../services/activity.js";

const commentSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  lineNumber: z.number().int().positive().nullable().optional(),
  parentId: z.string().min(1).nullable().optional()
});
const resolutionSchema = z.object({ resolved: z.boolean() });

async function canView(snippetId, userId) {
  const s = await prisma.snippet.findUnique({ where: { id: snippetId }, include: { permissions: true } });
  return s && (s.ownerId === userId || s.visibility !== "PRIVATE" || s.permissions.some(p => p.userId === userId));
}

export async function listComments(req, res, next) {
  try {
    if (!(await canView(req.params.id, req.user.sub))) return res.status(404).json({ message: "Snippet not found" });
    const comments = await prisma.comment.findMany({
      where: { snippetId: req.params.id, parentId: null },
      include: { user: { select: { id: true, name: true } }, replies: { include: { user: { select: { id: true, name: true } }, replies: { include: { user: { select: { id: true, name: true } } } } } } },
      orderBy: { createdAt: "asc" }
    });
    res.json({ comments });
  } catch (e) { next(e); }
}

export async function createComment(req, res, next) {
  try {
    const { body, lineNumber, parentId } = commentSchema.parse(req.body);
    if (!(await canView(req.params.id, req.user.sub))) return res.status(404).json({ message: "Snippet not found" });
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.snippetId !== req.params.id) return res.status(400).json({ message: "Invalid parent comment" });
    }
    const comment = await prisma.comment.create({
      data: { snippetId: req.params.id, userId: req.user.sub, body, lineNumber: lineNumber || null, parentId: parentId || null },
      include: { user: { select: { id: true, name: true } } }
    });
    const snippet = await prisma.snippet.findUnique({ where: { id: req.params.id } });
    if (snippet.ownerId !== req.user.sub) await notify(snippet.ownerId, parentId ? "REPLY" : "COMMENT", "New comment on your snippet", `/snippets/${snippet.id}`);
    await recordActivity(req.user.sub, "COMMENTED_ON_SNIPPET", snippet.id);
    res.status(201).json({ comment });
  } catch (e) { next(e); }
}

export async function resolveComment(req, res, next) {
  try {
    const { resolved } = resolutionSchema.parse(req.body);
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId }, include: { snippet: true } });
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    const permission = await prisma.snippetPermission.findUnique({ where: { snippetId_userId: { snippetId: comment.snippetId, userId: req.user.sub } } });
    if (comment.snippet.ownerId !== req.user.sub && req.user.role !== "ADMIN" && permission?.role !== "EDITOR")
      return res.status(403).json({ message: "No permission to resolve discussion" });
    const updated = await prisma.comment.update({ where: { id: comment.id }, data: { isResolved: resolved } });
    await recordActivity(req.user.sub, updated.isResolved ? "RESOLVED_DISCUSSION" : "REOPENED_DISCUSSION", comment.snippetId);
    return res.json({ comment: updated });
  } catch (e) { next(e); }
}
