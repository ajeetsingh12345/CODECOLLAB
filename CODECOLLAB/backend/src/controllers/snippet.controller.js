import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { recordActivity } from "../services/activity.js";

const schema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  content: z.string(),
  language: z.string().default("javascript"),
  visibility: z.enum(["PRIVATE", "PUBLIC", "UNLISTED"]).default("PRIVATE"),
  tags: z.array(z.string().min(1).max(30)).max(10).optional()
});
const shareSchema = z.object({
  email: z.string().email(),
  role: z.enum(["EDITOR", "VIEWER"])
});

async function buildTagRelations(tags = []) {
  const normalized = [...new Set(tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return undefined;

  return {
    create: await Promise.all(normalized.map(async name => ({
      tag: { connectOrCreate: { where: { name }, create: { name } } }
    })))
  };
}

async function access(snippetId, userId, write = false) {
  const snippet = await prisma.snippet.findUnique({ where: { id: snippetId } });
  if (!snippet) return null;
  if (snippet.ownerId === userId) return snippet;
  if (snippet.visibility === "PUBLIC" || snippet.visibility === "UNLISTED") {
    if (!write) return snippet;
  }
  const permission = await prisma.snippetPermission.findUnique({ where: { snippetId_userId: { snippetId, userId } } });
  if (permission && (!write || permission.role === "EDITOR")) return snippet;
  return null;
}

export async function listSnippets(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const search = String(req.query.search || "");
    const sharedOnly = req.query.shared === "true";
    const where = {
      OR: sharedOnly
        ? [{ permissions: { some: { userId: req.user.sub } } }]
        : [
            { ownerId: req.user.sub },
            { visibility: "PUBLIC" },
            { permissions: { some: { userId: req.user.sub } } }
          ],
      ...(req.query.language ? { language: String(req.query.language) } : {}),
      ...(search ? { AND: [{ OR: [{ title: { contains: search, mode: "insensitive" } }, { content: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }] } : {})
    };
    const [items, total] = await Promise.all([
      prisma.snippet.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          tags: { include: { tag: true } },
          ...(sharedOnly ? {
            permissions: {
              where: { userId: req.user.sub },
              select: { role: true }
            }
          } : {})
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.snippet.count({ where })
    ]);
    res.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
}

export async function createSnippet(req, res, next) {
  try {
    const data = schema.parse(req.body);
    const snippet = await prisma.snippet.create({
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        language: data.language,
        visibility: data.visibility,
        ownerId: req.user.sub,
        versions: {
          create: {
            title: data.title,
            content: data.content,
            language: data.language,
            userId: req.user.sub,
            message: "Initial version"
          }
        },
        tags: await buildTagRelations(data.tags)
      }
    });
    await recordActivity(req.user.sub, "CREATED_SNIPPET", snippet.id, snippet.title);
    res.status(201).json({ snippet });
  } catch (e) { next(e); }
}

export async function getSnippet(req, res, next) {
  try {
    const snippet = await access(req.params.id, req.user.sub);
    if (!snippet) return res.status(404).json({ message: "Snippet not found or access denied" });
    const full = await prisma.snippet.findUnique({
      where: { id: snippet.id },
      include: {
        owner: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
        permissions: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });
    res.json({ snippet: full });
  } catch (e) { next(e); }
}

export async function updateSnippet(req, res, next) {
  try {
    const current = await access(req.params.id, req.user.sub, true);
    if (!current) return res.status(403).json({ message: "No edit permission" });
    const data = schema.partial().parse(req.body);
    const updated = await prisma.$transaction(async tx => {
      const snippet = await tx.snippet.update({
        where: { id: current.id },
        data: {
          ...data,
          tags: data.tags ? { deleteMany: {}, ...(await buildTagRelations(data.tags)) } : undefined
        }
      });
      if (data.content !== undefined || data.title !== undefined || data.language !== undefined) {
        await tx.snippetVersion.create({ data: { snippetId: current.id, userId: req.user.sub, title: snippet.title, content: snippet.content, language: snippet.language, message: "Updated snippet" } });
      }
      return snippet;
    });
    await recordActivity(req.user.sub, "UPDATED_SNIPPET", updated.id, updated.title);
    res.json({ snippet: updated });
  } catch (e) { next(e); }
}

export async function deleteSnippet(req, res, next) {
  try {
    const snippet = await prisma.snippet.findUnique({ where: { id: req.params.id } });
    if (!snippet) return res.status(404).json({ message: "Snippet not found" });
    if (snippet.ownerId !== req.user.sub && req.user.role !== "ADMIN") return res.status(403).json({ message: "Only owner or admin can delete" });
    await prisma.snippet.delete({ where: { id: snippet.id } });
    await recordActivity(req.user.sub, "DELETED_SNIPPET", null, snippet.title);
    res.json({ message: "Snippet deleted" });
  } catch (e) { next(e); }
}

export async function versions(req, res, next) {
  try {
    const snippet = await access(req.params.id, req.user.sub);
    if (!snippet) return res.status(404).json({ message: "Snippet not found" });
    const items = await prisma.snippetVersion.findMany({ where: { snippetId: snippet.id }, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } });
    res.json({ items });
  } catch (e) { next(e); }
}

export async function restoreVersion(req, res, next) {
  try {
    const snippet = await access(req.params.id, req.user.sub, true);
    if (!snippet) return res.status(403).json({ message: "No edit permission" });
    const version = await prisma.snippetVersion.findFirst({ where: { id: req.params.versionId, snippetId: snippet.id } });
    if (!version) return res.status(404).json({ message: "Version not found" });
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.snippet.update({ where: { id: snippet.id }, data: { title: version.title, content: version.content, language: version.language } });
      await tx.snippetVersion.create({ data: { snippetId: snippet.id, userId: req.user.sub, title: result.title, content: result.content, language: result.language, message: `Restored version ${version.id}` } });
      return result;
    });
    await recordActivity(req.user.sub, "RESTORED_VERSION", snippet.id, version.id);
    res.json({ snippet: updated });
  } catch (e) { next(e); }
}

export async function shareSnippet(req, res, next) {
  try {
    const snippet = await prisma.snippet.findUnique({ where: { id: req.params.id } });
    if (!snippet || snippet.ownerId !== req.user.sub) return res.status(403).json({ message: "Only owner can manage access" });
    const { email, role } = shareSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ message: "User not found" });
    const permission = await prisma.snippetPermission.upsert({
      where: { snippetId_userId: { snippetId: snippet.id, userId: user.id } },
      update: { role }, create: { snippetId: snippet.id, userId: user.id, role }
    });
    res.json({ permission });
  } catch (e) { next(e); }
}
