import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { moderateContent } from "../utils/moderation";
import { getActiveBuildingKey } from "../db/helpers";

const router = Router();

const AD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_CATEGORIES = ["sell", "buy", "service", "invite", "lost", "found", "other"];

const AD_CATEGORY_RU: Record<string, string> = {
    sell: "Продаю", buy: "Ищу", service: "Услуга",
    invite: "Приглашаю", lost: "Потеряно", found: "Найдено", other: "Другое",
};

async function getPhotos(adIds: number[]): Promise<Record<number, string[]>> {
    if (!adIds.length) return {};
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ad_id, image_url FROM neighbor_ad_photos WHERE ad_id IN (?) ORDER BY ad_id, position`,
        [adIds],
    );
    const map: Record<number, string[]> = {};
    for (const r of rows) {
        const id = r.ad_id as number;
        if (!map[id]) map[id] = [];
        map[id].push(r.image_url as string);
    }
    return map;
}

async function insertPhotos(adId: number, imageUrls: string[]): Promise<void> {
    if (!imageUrls.length) return;
    for (let i = 0; i < imageUrls.length; i++) {
        await pool.execute(
            `INSERT INTO neighbor_ad_photos (ad_id, image_url, position, is_primary) VALUES (?, ?, ?, ?)`,
            [adId, imageUrls[i], i, i === 0 ? 1 : 0],
        );
    }
}

// GET /api/neighbor-ads
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const buildingKey = await getActiveBuildingKey(userId);
        if (!buildingKey) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT n.id, n.author_user_id, n.building_key, n.title, n.body, n.category,
                    n.show_phone, n.author_phone, n.pending_moderation, n.archived,
                    n.created_at, n.expires_at,
                    p.full_name AS author_name, p.profile_photo AS author_photo
             FROM neighbor_ads n
             LEFT JOIN user_profiles p ON p.user_id = n.author_user_id
             WHERE LOWER(n.building_key) = ?
             ORDER BY n.created_at DESC`,
            [buildingKey.toLowerCase()],
        );

        const adIds = rows.map((r) => r.id as number);
        const photosMap = await getPhotos(adIds);

        const ads = rows.map((r) => ({
            id: String(r.id),
            authorUserId: String(r.author_user_id),
            buildingKey: r.building_key as string,
            title: String(r.title),
            body: String(r.body),
            category: r.category as string,
            imageUrls: photosMap[r.id as number] ?? [],
            showPhone: Boolean(r.show_phone),
            authorPhone: (r.author_phone as string | null) ?? undefined,
            pendingModeration: Boolean(r.pending_moderation),
            archived: Boolean(r.archived),
            createdAt: (r.created_at as Date).toISOString(),
            expiresAt: (r.expires_at as Date).toISOString(),
            authorName: (r.author_name as string | null) ?? undefined,
            authorPhoto: (r.author_photo as string | null) ?? undefined,
        }));

        return res.json(ads);
    } catch (err) {
        console.error("[neighbor-ads GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/neighbor-ads
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { title, body, category, imageUrls, showPhone, authorPhone } = req.body as {
        title?: string;
        body?: string;
        category?: string;
        imageUrls?: string[];
        showPhone?: boolean;
        authorPhone?: string;
    };

    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Заголовок и текст обязательны" });
    if (!category || !VALID_CATEGORIES.includes(category))
        return res.status(400).json({ error: "Некорректная категория" });

    try {
        const mod = await moderateContent("ad", { title: title.trim(), body: body.trim(), category: AD_CATEGORY_RU[category] });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const buildingKey = await getActiveBuildingKey(userId);
        if (!buildingKey) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const expiresAt = new Date(Date.now() + AD_TTL_MS);
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO neighbor_ads
                (author_user_id, building_key, title, body, category, show_phone, author_phone, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, buildingKey, title.trim(), body.trim(), category,
                showPhone ? 1 : 0,
                showPhone && authorPhone ? authorPhone.trim() : null,
                expiresAt,
            ],
        );

        const adId = result.insertId;
        const urls = Array.isArray(imageUrls) ? imageUrls : [];
        await insertPhotos(adId, urls);

        return res.status(201).json({
            id: String(adId),
            authorUserId: String(userId),
            buildingKey,
            title: title.trim(),
            body: body.trim(),
            category,
            imageUrls: urls,
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

// PATCH /api/neighbor-ads/:id
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const adId = Number(req.params.id);
    const { title, body, category, imageUrls, showPhone, authorPhone } = req.body as {
        title?: string; body?: string; category?: string; imageUrls?: string[]; showPhone?: boolean; authorPhone?: string;
    };
    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Заголовок и текст обязательны" });
    if (category && !VALID_CATEGORIES.includes(category))
        return res.status(400).json({ error: "Некорректная категория" });
    try {
        let categoryCode = category;
        if (!categoryCode) {
            const [[existing]] = await pool.query<RowDataPacket[]>(
                `SELECT category FROM neighbor_ads WHERE id = ?`, [adId],
            );
            categoryCode = existing?.category as string | undefined;
        }

        const mod = await moderateContent("ad", { title: title.trim(), body: body.trim(), category: AD_CATEGORY_RU[categoryCode ?? ""] });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE neighbor_ads SET title=?, body=?, category=COALESCE(?,category),
             show_phone=?, author_phone=?
             WHERE id=? AND author_user_id=?`,
            [
                title.trim(), body.trim(), category ?? null,
                showPhone ? 1 : 0,
                showPhone && authorPhone ? authorPhone.trim() : null,
                adId, userId,
            ],
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Объявление не найдено или нет прав" });

        if (Array.isArray(imageUrls)) {
            await pool.execute(`DELETE FROM neighbor_ad_photos WHERE ad_id = ?`, [adId]);
            await insertPhotos(adId, imageUrls);
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, author_user_id, building_key, title, body, category,
                    show_phone, author_phone, pending_moderation, archived, created_at, expires_at
             FROM neighbor_ads WHERE id=?`, [adId],
        );
        const photosMap = await getPhotos([adId]);
        const r = rows[0];
        return res.json({
            id: String(r.id), authorUserId: String(r.author_user_id),
            buildingKey: r.building_key as string, title: String(r.title), body: String(r.body),
            category: r.category as string,
            imageUrls: photosMap[adId] ?? [],
            showPhone: Boolean(r.show_phone), authorPhone: r.author_phone ?? undefined,
            pendingModeration: Boolean(r.pending_moderation), archived: Boolean(r.archived),
            createdAt: (r.created_at as Date).toISOString(), expiresAt: (r.expires_at as Date).toISOString(),
        });
    } catch (err) {
        console.error("[neighbor-ads edit]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// DELETE /api/neighbor-ads/:id
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

// PATCH /api/neighbor-ads/:id/extend
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

// POST /api/neighbor-ads/:id/report
router.post("/:id/report", requireAuth, async (_req: AuthRequest, res) => {
    const adId = Number(_req.params.id);
    try {
        await pool.execute(`UPDATE neighbor_ads SET pending_moderation = 1 WHERE id = ?`, [adId]);
        return res.json({ ok: true });
    } catch (err) {
        console.error("[neighbor-ads report]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
