import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();
const MASS_APPEAL_THRESHOLD = 5;

async function getProfile(userId: number): Promise<{ buildingKey: string; apartment: string; entrance: string | null } | null> {
    const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT building_key, apartment, entrances FROM user_profiles WHERE user_id = ?`,
        [userId],
    );
    if (!row?.building_key) return null;
    const entranceNum = Number(row.entrances ?? 0);
    return {
        buildingKey: row.building_key as string,
        apartment: (row.apartment as string) ?? "",
        entrance: entranceNum > 0 ? String(entranceNum) : null,
    };
}

function mapAppealRow(v: RowDataPacket, parts: RowDataPacket[]): object {
    return {
        id: String(v.id),
        authorUserId: String(v.user_id),
        buildingKey: String(v.building_key),
        title: String(v.title),
        body: String(v.body),
        category: String(v.category ?? ""),
        kind: v.kind as string,
        status: v.status as string,
        entrance: v.entrance ? String(v.entrance) : undefined,
        authorApartment: String(v.author_apartment ?? ""),
        escalatedToUk: Boolean(v.escalated_to_uk),
        createdAt: (v.created_at as Date).toISOString(),
        participants: parts.map((p) => ({
            userId: String(p.user_id),
            apartment: String(p.apartment ?? ""),
            entrance: p.entrance ? String(p.entrance) : undefined,
            displayName: String(p.display_name ?? ""),
            anonymous: Boolean(p.anonymous),
            comment: p.comment ? String(p.comment) : undefined,
            photoUri: p.photo_uri ? String(p.photo_uri) : undefined,
            joinedAt: (p.joined_at as Date).toISOString(),
        })),
    };
}

async function fetchWithParticipants(appealIds: number[]): Promise<object[]> {
    if (appealIds.length === 0) return [];
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, user_id, building_key, title, body, category, kind, status,
                entrance, author_apartment, escalated_to_uk, created_at
         FROM appeals WHERE id IN (?) ORDER BY created_at DESC`,
        [appealIds],
    );
    const [parts] = await pool.query<RowDataPacket[]>(
        `SELECT appeal_id, user_id, apartment, entrance, display_name, anonymous, comment, photo_uri, joined_at
         FROM appeal_participants WHERE appeal_id IN (?)`,
        [appealIds],
    );
    const partsByAppeal = new Map<number, RowDataPacket[]>();
    for (const p of parts) {
        const aid = p.appeal_id as number;
        if (!partsByAppeal.has(aid)) partsByAppeal.set(aid, []);
        partsByAppeal.get(aid)!.push(p);
    }
    return rows.map((v) => mapAppealRow(v, partsByAppeal.get(v.id as number) ?? []));
}

// GET /api/appeals  — свои личные + коллективные дома
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const prof = await getProfile(userId);
        if (!prof) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM appeals
             WHERE (kind = 'personal' AND user_id = ?)
                OR (kind = 'collective' AND LOWER(building_key) = ?)
             ORDER BY created_at DESC`,
            [userId, prof.buildingKey.toLowerCase()],
        );
        if (rows.length === 0) return res.json([]);

        const ids = rows.map((r) => r.id as number);
        return res.json(await fetchWithParticipants(ids));
    } catch (err) {
        console.error("[appeals GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/appeals  — создать обращение
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { title, body, category, kind, entrance } = req.body as {
        title?: string; body?: string; category?: string; kind?: string; entrance?: string;
    };

    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    if (!["personal", "collective"].includes(kind ?? ""))
        return res.status(400).json({ error: "Некорректный тип обращения" });

    try {
        const prof = await getProfile(userId);
        if (!prof) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO appeals (user_id, building_key, title, body, category, kind, entrance, author_apartment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, prof.buildingKey, title.trim(), body.trim(), category?.trim() ?? "", kind!, entrance?.trim() || null, prof.apartment],
        );

        const results = await fetchWithParticipants([result.insertId]);
        return res.status(201).json(results[0]);
    } catch (err) {
        console.error("[appeals POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/appeals/:id/join  — присоединиться к коллективному
router.post("/:id/join", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const appealId = Number(req.params.id);
    const { anonymous, comment, photoUri, displayName } = req.body as {
        anonymous?: boolean; comment?: string; photoUri?: string; displayName?: string;
    };

    try {
        const prof = await getProfile(userId);
        if (!prof) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [[appeal]] = await pool.query<RowDataPacket[]>(
            `SELECT id, building_key, kind, status, entrance, user_id, escalated_to_uk
             FROM appeals WHERE id = ?`,
            [appealId],
        );
        if (!appeal) return res.status(404).json({ error: "Обращение не найдено" });
        if (appeal.kind !== "collective") return res.status(400).json({ error: "Обращение не коллективное" });
        if (Number(appeal.user_id) === userId)
            return res.status(400).json({ error: "Нельзя присоединиться к своему обращению" });
        if ((appeal.building_key as string).toLowerCase() !== prof.buildingKey.toLowerCase())
            return res.status(400).json({ error: "Это обращение другого дома" });

        try {
            await pool.execute(
                `INSERT INTO appeal_participants (appeal_id, user_id, apartment, entrance, display_name, anonymous, comment, photo_uri)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [appealId, userId, prof.apartment, prof.entrance ?? null,
                 displayName?.trim() ?? "", anonymous ? 1 : 0, comment?.trim() || null, photoUri || null],
            );
        } catch (e: any) {
            if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Вы уже присоединились" });
            throw e;
        }

        // Проверка порога эскалации
        if (!appeal.escalated_to_uk && !["resolved", "rejected"].includes(appeal.status as string)) {
            const entranceCond = appeal.entrance
                ? `AND (ap.entrance IS NULL OR ap.entrance = ${pool.escape(appeal.entrance)})`
                : "";
            const [[countRow]] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT apt) AS cnt FROM (
                    SELECT author_apartment AS apt FROM appeals WHERE id = ?
                    UNION ALL
                    SELECT ap.apartment AS apt FROM appeal_participants ap
                    WHERE ap.appeal_id = ? ${entranceCond}
                ) t`,
                [appealId, appealId],
            );
            if (Number(countRow?.cnt ?? 0) >= MASS_APPEAL_THRESHOLD) {
                await pool.execute(
                    `UPDATE appeals SET status = 'accepted', escalated_to_uk = 1 WHERE id = ? AND escalated_to_uk = 0`,
                    [appealId],
                );
            }
        }

        const updated = await fetchWithParticipants([appealId]);
        return res.json(updated[0]);
    } catch (err) {
        console.error("[appeals join]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// PATCH /api/appeals/:id  — редактировать своё обращение (сбрасывает статус и участников)
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const appealId = Number(req.params.id);
    const { title, body, category, entrance } = req.body as {
        title?: string; body?: string; category?: string; entrance?: string;
    };
    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    try {
        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE appeals SET title=?, body=?, category=?, entrance=?, status='new', escalated_to_uk=0
             WHERE id=? AND user_id=?`,
            [title.trim(), body.trim(), category?.trim() ?? "", entrance?.trim() || null, appealId, userId],
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Обращение не найдено или нет прав" });
        await pool.execute(`DELETE FROM appeal_participants WHERE appeal_id=?`, [appealId]);
        const updated = await fetchWithParticipants([appealId]);
        return res.json(updated[0]);
    } catch (err) {
        console.error("[appeals PATCH]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// DELETE /api/appeals/:id  — удалить своё обращение
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const appealId = Number(req.params.id);
    try {
        const [result] = await pool.execute<ResultSetHeader>(
            `DELETE FROM appeals WHERE id = ? AND user_id = ?`,
            [appealId, userId],
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Обращение не найдено или нет прав" });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[appeals DELETE]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
