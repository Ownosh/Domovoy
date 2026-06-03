import { Router } from "express";
import axios from "axios";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/imagekit/upload
router.post("/upload", requireAuth, async (req: AuthRequest, res) => {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
        return res.status(503).json({ error: "ImageKit не настроен" });
    }

    const { fileBase64, fileName } = req.body as { fileBase64?: string; fileName?: string };
    if (!fileBase64 || !fileName) {
        return res.status(400).json({ error: "fileBase64 и fileName обязательны" });
    }

    try {
        const auth = Buffer.from(`${privateKey}:`).toString("base64");

        const response = await axios.post<{ url: string }>(
            "https://upload.imagekit.io/api/v1/files/upload",
            {
                file: `data:image/jpeg;base64,${fileBase64}`,
                fileName,
                folder: "/neighbor_ads",
                useUniqueFileName: "true",
            },
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                },
                timeout: 60_000,
            },
        );

        return res.json({ url: response.data.url });
    } catch (err: any) {
        const msg: string = err?.response?.data?.message ?? err?.message ?? "Ошибка загрузки на ImageKit";
        console.error("[imagekit upload]", msg);
        return res.status(500).json({ error: msg });
    }
});

export default router;
