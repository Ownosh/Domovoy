import { Router } from "express";

import { pool } from "../db/client";

import { requireAuth, AuthRequest } from "../middleware/auth";

import { RowDataPacket, ResultSetHeader } from "mysql2";

import { moderateContent } from "../utils/moderation";

import { getActiveApartment } from "../db/helpers";



const router = Router();



const AD_TTL_MS = 30 * 24 * 60 * 60 * 1000;



const VALID_CATEGORIES = ["sell", "buy", "service", "invite", "lost", "found", "other"];



const AD_CATEGORY_RU: Record<string, string> = {

    sell: "Продаю", buy: "Ищу", service: "Услуга",

    invite: "Приглашаю", lost: "Потеряно", found: "Найдено", other: "Другое",

};



const AD_SELECT = `

    SELECT n.id, ua.user_id AS author_user_id, ua.building_key, n.title, n.body, n.category,

           n.show_phone, n.status, n.created_at, n.expires_at,

           p.full_name AS author_name, p.profile_photo AS author_photo, p.phone AS author_phone

    FROM neighbor_ads n

    JOIN user_apartments ua ON ua.id = n.author_apartment_id

    LEFT JOIN user_profiles p ON p.user_id = ua.user_id

`;



async function getPhotos(adIds: number[]): Promise<Record<number, string[]>> {

    if (!adIds.length) return {};

    const [rows] = await pool.query<RowDataPacket[]>(

        `SELECT neighbor_ad_id, url

         FROM neighbor_ad_photos

         WHERE neighbor_ad_id IN (?)

         ORDER BY neighbor_ad_id, position`,

        [adIds],

    );

    const map: Record<number, string[]> = {};

    for (const r of rows) {

        const id = Number(r.neighbor_ad_id);

        if (!map[id]) map[id] = [];

        map[id].push(r.url as string);

    }

    return map;

}



async function insertPhotos(adId: number, imageUrls: string[]): Promise<void> {

    if (!imageUrls.length) return;

    for (let i = 0; i < imageUrls.length; i++) {

        await pool.execute(

            `INSERT IGNORE INTO neighbor_ad_photos (neighbor_ad_id, url, position, is_primary)

             VALUES (?, ?, ?, ?)`,

            [adId, imageUrls[i], i, i === 0 ? 1 : 0],

        );

    }

}



function mapNeighborAdRow(r: RowDataPacket, photos: string[]): object {

    const showPhone = Boolean(r.show_phone);

    const profilePhone = (r.author_phone as string | null)?.trim() || undefined;

    return {

        id: String(r.id),

        authorUserId: String(r.author_user_id),

        buildingKey: r.building_key as string,

        title: String(r.title),

        body: String(r.body),

        category: r.category as string,

        imageUrls: photos,

        showPhone,

        authorPhone: showPhone ? profilePhone : undefined,

        status: r.status as string,

        pendingModeration: r.status === "under_review" || r.status === "under_review_appeal",

        archived: r.status === "archived",

        createdAt: (r.created_at as Date).toISOString(),

        expiresAt: (r.expires_at as Date).toISOString(),

        authorName: (r.author_name as string | null) ?? undefined,

        authorPhoto: (r.author_photo as string | null) ?? undefined,

    };

}



// GET /api/neighbor-ads

router.get("/", requireAuth, async (req: AuthRequest, res) => {

    const userId = req.userId!;

    try {

        const apt = await getActiveApartment(userId);

        if (!apt) return res.status(400).json({ error: "Профиль не привязан к дому" });



        const [rows] = await pool.query<RowDataPacket[]>(

            `${AD_SELECT}

             WHERE LOWER(ua.building_key) = ?
               AND NOT (n.status = 'published' AND n.expires_at <= NOW())

             ORDER BY n.created_at DESC`,

            [apt.buildingKey.toLowerCase()],

        );



        const adIds = rows.map((r) => r.id as number);

        const photosMap = await getPhotos(adIds);



        return res.json(rows.map((r) => mapNeighborAdRow(r, photosMap[r.id as number] ?? [])));

    } catch (err) {

        console.error("[neighbor-ads GET]", err);

        return res.status(500).json({ error: "Ошибка сервера" });

    }

});



// POST /api/neighbor-ads

router.post("/", requireAuth, async (req: AuthRequest, res) => {

    const userId = req.userId!;

    const { title, body, category, imageUrls, showPhone } = req.body as {

        title?: string;

        body?: string;

        category?: string;

        imageUrls?: string[];

        showPhone?: boolean;

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



        const apt = await getActiveApartment(userId);

        if (!apt) return res.status(400).json({ error: "Профиль не привязан к дому" });



        const expiresAt = new Date(Date.now() + AD_TTL_MS);

        const [result] = await pool.execute<ResultSetHeader>(

            `INSERT INTO neighbor_ads

                (author_apartment_id, title, body, category, show_phone, expires_at, status)

             VALUES (?, ?, ?, ?, ?, ?, 'published')`,

            [apt.apartmentId, title.trim(), body.trim(), category, showPhone ? 1 : 0, expiresAt],

        );



        const adId = result.insertId;

        const urls = Array.isArray(imageUrls) ? imageUrls : [];

        await insertPhotos(adId, urls);



        const [[row]] = await pool.query<RowDataPacket[]>(`${AD_SELECT} WHERE n.id = ?`, [adId]);



        return res.status(201).json(mapNeighborAdRow(row, urls));

    } catch (err) {

        console.error("[neighbor-ads POST]", err);

        return res.status(500).json({ error: "Ошибка сервера" });

    }

});



// PATCH /api/neighbor-ads/:id

router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {

    const userId = req.userId!;

    const adId = Number(req.params.id);

    const { title, body, category, imageUrls, showPhone } = req.body as {

        title?: string; body?: string; category?: string; imageUrls?: string[]; showPhone?: boolean;

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

            `UPDATE neighbor_ads n

             JOIN user_apartments ua ON ua.id = n.author_apartment_id

             SET n.title=?, n.body=?, n.category=COALESCE(?, n.category),

                 n.show_phone=?,

                 n.status=IF(n.status='rejected','under_review_appeal',n.status)

             WHERE n.id=? AND ua.user_id=?`,

            [title.trim(), body.trim(), category ?? null, showPhone ? 1 : 0, adId, userId],

        );

        if (result.affectedRows === 0)

            return res.status(404).json({ error: "Объявление не найдено или нет прав" });



        if (Array.isArray(imageUrls)) {

            await pool.execute(`DELETE FROM neighbor_ad_photos WHERE neighbor_ad_id = ?`, [adId]);

            await insertPhotos(adId, imageUrls);

        }



        const [rows] = await pool.query<RowDataPacket[]>(`${AD_SELECT} WHERE n.id = ?`, [adId]);

        const photosMap = await getPhotos([adId]);

        return res.json(mapNeighborAdRow(rows[0], photosMap[adId] ?? []));

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

            `DELETE n FROM neighbor_ads n

             JOIN user_apartments ua ON ua.id = n.author_apartment_id

             WHERE n.id = ? AND ua.user_id = ?`,

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

            `UPDATE neighbor_ads n

             JOIN user_apartments ua ON ua.id = n.author_apartment_id

             SET n.expires_at = ?, n.status = IF(n.status='archived','published',n.status)

             WHERE n.id = ? AND ua.user_id = ?`,

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

        await pool.execute(

            `UPDATE neighbor_ads SET status = 'under_review'

             WHERE id = ? AND status NOT IN ('under_review', 'under_review_appeal', 'rejected')`,

            [adId],

        );

        return res.json({ ok: true });

    } catch (err) {

        console.error("[neighbor-ads report]", err);

        return res.status(500).json({ error: "Ошибка сервера" });

    }

});



export default router;

