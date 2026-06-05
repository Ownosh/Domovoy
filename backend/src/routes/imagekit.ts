import { Router } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import path from "path";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "ru-1",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET!;

router.post("/upload", requireAuth, async (req: AuthRequest, res) => {
    const { fileBase64, fileName } = req.body as { fileBase64?: string; fileName?: string };
    if (!fileBase64 || !fileName) {
        return res.status(400).json({ error: "fileBase64 и fileName обязательны" });
    }

    try {
        const ext = path.extname(fileName) || ".jpg";
        const key = `uploads/${randomBytes(8).toString("hex")}${ext}`;
        const buffer = Buffer.from(fileBase64, "base64");

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: "image/jpeg",
        }));

        const url = `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
        return res.json({ url });
    } catch (err: any) {
        console.error("[s3 upload]", err?.message);
        return res.status(500).json({ error: err?.message ?? "Ошибка загрузки в S3" });
    }
});

export default router;
