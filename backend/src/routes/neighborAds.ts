import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

const AD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_CATEGORIES = ["sell", "buy", "service", "invite", "lost", "found", "other"];

async function getBuildingKey(userId: number): Promise<string | null> {
    const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT building_key FROM user_profiles WHERE user_id = ?`,
        [userId],
    );
    return (row?.building_key as string | null) ?? null;
}

// GET /api/neighbor-ads  — объявления дома
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const buildingKey = await getBuildingKey(userId);
        if (!buildingKey) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, author_user_id, building_key, title, body, category,
                    image_url, show_phone, author_phone, pending_moderation, archived,
                    created_at, expires_at
             FROM neighbor_ads
             WHERE LOWER(building_key) = ?
             ORDER BY created_at DESC`,
            [buildingKey.toLowerCase()],
        );

        const ads = rows.map((r) => ({
            id: String(r.id),
            authorUserId: String(r.author_user_id),
            buildingKey: r.building_key as string,
            title: String(r.title),
            body: String(r.body),
            category: r.category as string,
            imageUrl: (r.image_url as string | null) ?? undefined,
            showPhone: Boolean(r.show_phone),
            authorPhone: (r.author_phone as string | null) ?? undefined,
            pendingModeration: Boolean(r.pending_moderation),
            archived: Boolean(r.archived),
            createdAt: (r.created_at as Date).toISOString(),
            expiresAt: (r.expires_at as Date).toISOString(),
        }));

        return res.json(ads);
    } catch (err) {
        console.error("[neighbor-ads GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/neighbor-ads  — создать объявление
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { title, body, category, imageUrl, showPhone, authorPhone } = req.body as {
        title?: string;
        body?: string;
        category?: string;
        imageUrl?: string;
        showPhone?: boolean;
        authorPhone?: string;
    };

    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Заголовок и текст обязательны" });
    if (!category || !VALID_CATEGORIES.includes(category))
        return res.status(400).json({ error: "Некорректная категория" });

    try {
        const buildingKey = await getBuildingKey(userId);
        if (!buildingKey) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const expiresAt = new Date(Date.now() + AD_TTL_MS);
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO neighbor_ads
                (author_user_id, building_key, title, body, category, image_url, show_phone, author_phone, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, buildingKey, title.trim(), body.trim(), category,
                imageUrl ?? null, showPhone ? 1 : 0,
                showPhone && authorPhone ? authorPhone.trim() : null,
                expiresAt,
            ],
        );

        const adId = result.insertId;
        return res.status(201).json({
            id: String(adId),
            authorUserId: String(userId),
            buildingKey,
            title: title.trim(),
            body: body.trim(),
            category,
            imageUrl: imageUrl ?? undefined,
            showPhone: Boolean(showPhone),
            authorPhone: showPhone && authorPhone ? authorPhone.trim() : undefined,
            pendingModeration: false,
            archived: false,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
        });
    } catch (err) {
        console.error("[neighbor-ads POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// DELETE /api/neighbor-ads/:id  — удалить своё объявление
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const adId = Number(req.params.id);
    try {
        const [result] = await pool.execute<ResultSetHeader>(
            `DELETE FROM neighbor_ads WHERE id = ? AND author_user_id = ?`,
            [adId, userId],
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Объявление не найдено или нет прав" });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[neighbor-ads DELETE]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// PATCH /api/neighbor-ads/:id/extend  — продлить на 30 дней
router.patch("/:id/extend", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const adId = Number(req.params.id);
    try {
        const newExpiry = new Date(Date.now() + AD_TTL_MS);
        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE neighbor_ads SET expires_at = ?, archived = 0 WHERE id = ? AND author_user_id = ?`,
            [newExpiry, adId, userId],
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Объявление не найдено или нет прав" });
        return res.json({ ok: true, expiresAt: newExpiry.toISOString() });
    } catch (err) {
        console.error("[neighbor-ads extend]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/neighbor-ads/:id/report  — пожаловаться
router.post("/:id/report", requireAuth, async (_req: AuthRequest, res) => {
    const adId = Number(_req.params.id);
    try {
        await pool.execute(
            `UPDATE neighbor_ads SET pending_moderation = 1 WHERE id = ?`,
            [adId],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[neighbor-ads report]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
