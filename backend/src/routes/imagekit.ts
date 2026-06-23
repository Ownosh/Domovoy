import { Router } from "express";
import path from "path";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { storeUploadedFile } from "../utils/fileStorage";

const router = Router();

router.post("/upload", requireAuth, async (req: AuthRequest, res) => {
    const { fileBase64, fileName } = req.body as { fileBase64?: string; fileName?: string };
    if (!fileBase64 || !fileName) {
        return res.status(400).json({ error: "fileBase64 и fileName обязательны" });
    }

    try {
        const ext = path.extname(fileName) || ".jpg";
        const buffer = Buffer.from(fileBase64, "base64");
        const url = await storeUploadedFile(buffer, ext, "image/jpeg", req);
        return res.json({ url });
    } catch (err: any) {
        console.error("[imagekit upload]", err?.message);
        return res.status(500).json({ error: err?.message ?? "Ошибка загрузки" });
    }
});

export default router;
