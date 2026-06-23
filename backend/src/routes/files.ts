import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { publicImageUrl, storeUploadedFile, createPresignedUpload, isS3Configured, readStoredFile } from "../utils/fileStorage";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Только изображения"));
    },
});

/** Presigned URL для прямой загрузки в S3 с телефона (быстрее, чем через backend) */
router.post("/presign-avatar", requireAuth, async (req: AuthRequest, res) => {
    if (!isS3Configured()) {
        return res.status(503).json({ error: "S3 не настроен" });
    }
    try {
        const { contentType } = req.body as { contentType?: string };
        const type = contentType?.startsWith("image/") ? contentType : "image/jpeg";
        const result = await createPresignedUpload(type, ".jpg", req, "avatar");
        return res.json(result);
    } catch (err: any) {
        console.error("[files presign]", err?.message);
        return res.status(500).json({ error: err?.message ?? "Ошибка presign" });
    }
});

/** Отдача файла из S3 / локального хранилища (для аватаров и фото) */
router.get("/serve", async (req, res) => {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    const file = await readStoredFile(key);
    if (!file) {
        return res.status(404).json({ error: "Файл не найден" });
    }
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    file.body.pipe(res);
});

router.post("/upload", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Файл не получен" });
    }
    if (req.file.size === 0) {
        return res.status(400).json({ error: "Файл пустой — повторите загрузку" });
    }

    try {
        const ext = path.extname(req.file.originalname) || ".jpg";
        const purpose = req.query.purpose === "avatar" ? "avatar" : "feed";
        const url = await storeUploadedFile(
            req.file.buffer,
            ext,
            req.file.mimetype,
            req,
            purpose,
        );
        console.log(`[files upload] user=${req.userId} purpose=${purpose} size=${req.file.size} url=${url}`);
        return res.json({ url });
    } catch (err: any) {
        console.error("[files upload]", err?.message);
        return res.status(500).json({ error: err?.message ?? "Ошибка загрузки файла" });
    }
});

export default router;
