import { Router, type IRouter } from "express";
import multer from "multer";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { InvalidImageError, saveUploadedImage } from "../lib/images";

const router: IRouter = Router();

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Kept in memory: every upload is re-encoded by sharp before anything touches the disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_TYPES.has(file.mimetype)),
});

router.post("/upload", requireAuth, requireAdmin, (req, res, next) => {
  upload.single("file")(req, res, async (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "حجم فایل بیشتر از ۵ مگابایت است" : "آپلود انجام نشد" });
      return;
    }
    if (err) { next(err); return; }
    if (!req.file) { res.status(400).json({ error: "فقط فایل‌های JPG، PNG، WEBP و GIF پذیرفته می‌شوند" }); return; }
    try {
      const saved = await saveUploadedImage(req.file.buffer);
      res.json({ url: saved.url, width: saved.width, height: saved.height, size: saved.size });
    } catch (error) {
      if (error instanceof InvalidImageError) { res.status(400).json({ error: error.message }); return; }
      next(error);
    }
  });
});

export default router;
