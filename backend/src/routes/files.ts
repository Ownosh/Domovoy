import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// Папка для хранения загруженных файлов
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".jpg";
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 МБ
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Только изображения"));
        }
    },
});

// POST /api/files/upload
router.post("/upload", requireAuth, upload.single("file"), (req: AuthRequest, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Файл не получен" });
    }
    const serverUrl = process.env.SERVER_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const url = `${serverUrl}/uploads/${req.file.filename}`;
    return res.json({ url });
});

export default router;
