import path from "path";
import fs from "fs/promises";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/constants";
import type { UserRole } from "@/types/user";
import { logger } from "@/lib/logger";

export const FILE_ROUTE_PREFIX = "/api/files/";

export type FileVisibility = "PUBLIC" | "RESTRICTED";

/** Thrown when no durable object store is configured for a production deploy. */
export class FileStorageUnavailableError extends Error {
  constructor() {
    super("BLOB_READ_WRITE_TOKEN is not configured: file storage is unavailable");
    this.name = "FileStorageUnavailableError";
  }
}

/** Files live outside `public/` so they are never served as static assets. */
function privateUploadsDir() {
  return process.env.PRIVATE_UPLOADS_DIR
    ? path.resolve(process.env.PRIVATE_UPLOADS_DIR)
    : path.resolve(process.cwd(), "private", "uploads");
}

function resolveWithinUploads(storagePath: string) {
  const dir = privateUploadsDir();
  const resolved = path.resolve(dir, storagePath);
  if (resolved !== dir && !resolved.startsWith(dir + path.sep)) {
    throw new Error("Invalid file path: directory traversal detected");
  }
  return resolved;
}

/**
 * `name` carries the original filename so a client can tell a PDF from a photo
 * without fetching it; `fileIdFromUrl` ignores the query string.
 */
export function fileUrl(id: string, filename?: string) {
  if (!filename) return `${FILE_ROUTE_PREFIX}${id}`;
  return `${FILE_ROUTE_PREFIX}${id}?name=${encodeURIComponent(filename)}`;
}

/** `/api/files/<id>` → `<id>`; anything else (legacy `/uploads/...`, blob URLs) → null. */
export function fileIdFromUrl(url: string | null | undefined) {
  if (!url || !url.startsWith(FILE_ROUTE_PREFIX)) return null;
  const id = url.slice(FILE_ROUTE_PREFIX.length).split(/[?#/]/)[0];
  return id || null;
}

export async function storeUploadedFile(params: {
  file: File;
  userId: string;
  visibility: FileVisibility;
}): Promise<{ id: string; url: string }> {
  const { file, userId, visibility } = params;
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 200);
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  let storagePath: string | null = null;
  let storageUrl: string | null = null;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // @vercel/blob 2.x only supports `access: "public"`, so the object URL is
    // treated as a secret: it is stored server-side and clients only ever get
    // `/api/files/<id>`, which authorizes every read. `addRandomSuffix` keeps
    // the object path unguessable.
    const blob = await put(uniqueName, file, {
      access: "public",
      addRandomSuffix: true,
    });
    storageUrl = blob.url;
  } else if (process.env.NODE_ENV === "production") {
    // Serverless filesystems are wiped on every deploy, so disk storage would
    // silently lose student work; refuse the upload instead.
    throw new FileStorageUnavailableError();
  } else {
    const dir = privateUploadsDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(resolveWithinUploads(uniqueName), Buffer.from(await file.arrayBuffer()));
    storagePath = uniqueName;
  }

  const record = await prisma.uploadedFile.create({
    data: {
      userId,
      filename: safeName || "upload",
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      storageUrl,
      visibility,
    },
    select: { id: true, filename: true },
  });

  return { id: record.id, url: fileUrl(record.id, record.filename) };
}

export function visibilityForUploader(role: UserRole): FileVisibility {
  // Staff uploads are course material (question images, feedback images) that
  // students must be able to open; student uploads are their own work.
  return isStaff(role) ? "PUBLIC" : "RESTRICTED";
}

export async function loadUploadedFile(id: string) {
  return prisma.uploadedFile.findFirst({ where: { id, isDeleted: false } });
}

export function canReadUploadedFile(
  file: { userId: string; visibility: string },
  viewer: { id: string; role: UserRole }
) {
  if (isStaff(viewer.role)) return true;
  if (file.visibility === "PUBLIC") return true;
  return file.userId === viewer.id;
}

export async function readFileBytes(file: {
  storagePath: string | null;
  storageUrl: string | null;
}): Promise<Buffer | null> {
  if (file.storagePath) {
    try {
      return await fs.readFile(resolveWithinUploads(file.storagePath));
    } catch (err) {
      logger.error("Stored file missing on disk", {
        route: "/api/files",
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
  if (file.storageUrl) {
    const res = await fetch(file.storageUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  return null;
}

/**
 * Server-side read of a stored file by the URL kept in the database. Handles
 * both `/api/files/<id>` records and legacy `/uploads/...` public assets.
 */
export async function readBytesForUrl(
  url: string
): Promise<{ bytes: Buffer; filename: string } | null> {
  const id = fileIdFromUrl(url);
  if (id) {
    const file = await loadUploadedFile(id);
    if (!file) return null;
    const bytes = await readFileBytes(file);
    return bytes ? { bytes, filename: file.filename } : null;
  }

  if (url.startsWith("/uploads/")) {
    const publicDir = path.resolve(process.cwd(), "public");
    const resolved = path.resolve(publicDir, url.replace(/^\//, ""));
    if (!resolved.startsWith(publicDir + path.sep)) return null;
    try {
      return { bytes: await fs.readFile(resolved), filename: path.basename(resolved) };
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok) return null;
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      filename: path.basename(new URL(url).pathname),
    };
  }

  return null;
}

/**
 * Inlines a stored image as a data URI for AI providers, which cannot fetch
 * authenticated or relative URLs themselves.
 */
export async function toDataUri(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;

  const id = fileIdFromUrl(url);
  const mimeType = id ? (await loadUploadedFile(id))?.mimeType : undefined;
  const file = await readBytesForUrl(url);
  if (!file) return null;

  const type = mimeType || mimeFromFilename(file.filename);
  return `data:${type};base64,${file.bytes.toString("base64")}`;
}

function mimeFromFilename(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "image/jpeg";
}

/**
 * Revokes access to a file previously returned by `storeUploadedFile` and
 * removes the bytes. Legacy `/uploads/...` URLs are ignored (they predate the
 * private storage route).
 */
export async function deleteFileByUrl(url: string | null | undefined) {
  const id = fileIdFromUrl(url);
  if (!id) return;
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file || file.isDeleted) return;

  await prisma.uploadedFile.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  try {
    if (file.storagePath) {
      await fs.unlink(resolveWithinUploads(file.storagePath));
    } else if (file.storageUrl) {
      await del(file.storageUrl);
    }
  } catch (err) {
    logger.warn("Failed to remove stored file bytes", {
      route: "file-storage",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
