import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp, { type OutputInfo } from "sharp";
import type { RequestHandler } from "express";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const CACHE_DIR = path.join(UPLOADS_DIR, ".cache");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/** Widths the storefront may request with ?w= (cards, thumbnails, product page). */
export const RESIZE_WIDTHS = [160, 400, 800] as const;
const MAX_DIMENSION = 1600;

export class InvalidImageError extends Error {}

/**
 * Decodes the upload (so a non-image with an image mime type is rejected),
 * applies EXIF rotation, caps it at 1600px and stores it as WebP.
 * Returns the public URL.
 */
export async function saveUploadedImage(buffer: Buffer): Promise<{ url: string; width: number; height: number; size: number }> {
  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new InvalidImageError("فایل تصویر معتبر نیست");
  }
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
  await fs.promises.writeFile(path.join(UPLOADS_DIR, name), output.data);
  return { url: `/api/uploads/${name}`, width: output.info.width, height: output.info.height, size: output.info.size };
}

/**
 * Serves /api/uploads/<file>?w=<width> as a resized WebP, cached on disk.
 * Requests without ?w= (or for SVGs) fall through to the static handler.
 */
export const resizedImages: RequestHandler = async (req, res, next) => {
  const width = Number(req.query.w);
  const file = path.basename(req.path);
  if (!width || !/\.(webp|png|jpe?g|gif)$/i.test(file)) { next(); return; }
  if (!RESIZE_WIDTHS.includes(width as (typeof RESIZE_WIDTHS)[number])) {
    res.status(400).json({ error: `w must be one of ${RESIZE_WIDTHS.join(", ")}` });
    return;
  }

  const source = path.join(UPLOADS_DIR, file);
  const cached = path.join(CACHE_DIR, String(width), file.replace(/\.\w+$/, ".webp"));
  try {
    if (!fs.existsSync(cached)) {
      if (!fs.existsSync(source)) { next(); return; }
      await fs.promises.mkdir(path.dirname(cached), { recursive: true });
      // Write to a temp name first so a concurrent request never serves a half-written file.
      const temp = `${cached}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(temp);
      await fs.promises.rename(temp, cached);
    }
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    // The cache lives in a dot-folder, which sendFile refuses unless told otherwise.
    res.type("image/webp").sendFile(cached, { dotfiles: "allow" });
  } catch (err) {
    next(err);
  }
};
