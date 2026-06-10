import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { moderateContent } from "../utils/moderation";

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

async function getAppealPhotos(appealIds: number[]): Promise<Record<number, string[]>> {
    if (!appealIds.length) return {};
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT appeal_id, image_url FROM appeal_photos WHERE appeal_id IN (?) ORDER BY appeal_id, position`,
        [appealIds],
    );
    const map: Record<number, string[]> = {};
    for (const r of rows) {
        const id = r.appeal_id as number;
        if (!map[id]) map[id] = [];
        map[id].push(r.image_url as string);
    }
    return map;
}

async function insertAppealPhotos(appealId: number, imageUrls: string[]): Promise<void> {
    for (let i = 0; i < imageUrls.length; i++) {
        await pool.execute(
            `INSERT INTO appeal_photos (appeal_id, image_url, position) VALUES (?, ?, ?)`,
            [appealId, imageUrls[i], i],
        );
    }
}

const STATUS_MAP: Record<string, string> = {
    accepted: "in_progress",
    mass_appeal: "collecting_signatures",
};

function normalizeStatus(s: string): string {
    return STATUS_MAP[s] ?? s;
}

function mapAppealRow(v: RowDataPacket, parts: RowDataPacket[], photoUrls: string[]): object {
    return {
        id: String(v.id),
        authorUserId: String(v.user_id),
        buildingKey: String(v.building_key),
        title: String(v.title),
        body: String(v.body),
        category: String(v.category ?? ""),
        kind: v.kind as string,
        status: normalizeStatus(v.status as string),
        entrance: v.entrance ? String(v.entrance) : undefined,
        authorApartment: String(v.author_apartment ?? ""),
        escalatedToUk: Boolean(v.escalated_to_uk),
        createdAt: (v.created_at as Date).toISOString(),
        resolvedAt: v.resolved_at ? (v.resolved_at as Date).toISOString() : undefined,
        manuallyArchived: Boolean(v.manually_archived),
        adminComment: (v.admin_comment as string | null) ?? undefined,
        adminCommentAt: v.admin_comment_at ? (v.admin_comment_at as Date).toISOString() : undefined,
        authorName: (v.author_name as string | null) ?? undefined,
        authorPhoto: (v.author_photo as string | null) ?? undefined,
        imageUrls: photoUrls,
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
        `SELECT a.id, a.user_id, a.building_key, a.title, a.body, a.category, a.kind, a.status,
                a.entrance, a.author_apartment, a.escalated_to_uk, a.created_at,
                a.resolved_at, a.manually_archived, a.admin_comment, a.admin_comment_at,
                p.full_name AS author_name, p.profile_photo AS author_photo
         FROM appeals a
         LEFT JOIN user_profiles p ON p.user_id = a.user_id
         WHERE a.id IN (?) ORDER BY a.created_at DESC`,
        [appealIds],
    );
    const [parts] = await pool.query<RowDataPacket[]>(
        `SELECT appeal_id, user_id, apartment, entrance, display_name, anonymous, comment, photo_uri, joined_at
         FROM appeal_participants WHERE appeal_id IN (?)`,
        [appealIds],
    );
    const photosMap = await getAppealPhotos(appealIds);
    const partsByAppeal = new Map<number, RowDataPacket[]>();
    for (const p of parts) {
        const aid = p.appeal_id as number;
        if (!partsByAppeal.has(aid)) partsByAppeal.set(aid, []);
        partsByAppeal.get(aid)!.push(p);
    }
    return rows.map((v) => mapAppealRow(
        v,
        partsByAppeal.get(v.id as number) ?? [],
        photosMap[v.id as number] ?? [],
    ));
}

// GET /api/appeals
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

// POST /api/appeals
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { title, body, category, kind, entrance, imageUrls } = req.body as {
        title?: string; body?: string; category?: string; kind?: string; entrance?: string; imageUrls?: string[];
    };

    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    if (!["personal", "collective"].includes(kind ?? ""))
        return res.status(400).json({ error: "Некорректный тип обращения" });

    try {
        const mod = await moderateContent({ title: title.trim(), body: body.trim(), category: category?.trim() });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const prof = await getProfile(userId);
        if (!prof) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const initialStatus = kind === "collective" ? "collecting_signatures" : "new";
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO appeals (user_id, building_key, title, body, category, kind, entrance, author_apartment, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, prof.buildingKey, title.trim(), body.trim(), category?.trim() ?? "", kind!, entrance?.trim() || null, prof.apartment, initialStatus],
        );

        const urls = Array.isArray(imageUrls) ? imageUrls : [];
        await insertAppealPhotos(result.insertId, urls);

        const results = await fetchWithParticipants([result.insertId]);
        return res.status(201).json(results[0]);
    } catch (err) {
        console.error("[appeals POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/appeals/:id/join
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
                    `UPDATE appeals SET status = 'in_progress', escalated_to_uk = 1 WHERE id = ? AND escalated_to_uk = 0`,
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

// PATCH /api/appeals/:id
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const appealId = Number(req.params.id);
    const { title, body, category, entrance, imageUrls } = req.body as {
        title?: string; body?: string; category?: string; entrance?: string; imageUrls?: string[];
    };
    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    try {
        const mod = await moderateContent({ title: title.trim(), body: body.trim(), category: category?.trim() });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE appeals SET title=?, body=?, category=?, entrance=?, status='new', escalated_to_uk=0
             WHERE id=? AND user_id=?`,
            [title.trim(), body.trim(), category?.trim() ?? "", entrance?.trim() || null, appealId, userId],
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Обращение не найдено или нет прав" });
        await pool.execute(`DELETE FROM appeal_participants WHERE appeal_id=?`, [appealId]);

        if (Array.isArray(imageUrls)) {
            await pool.execute(`DELETE FROM appeal_photos WHERE appeal_id=?`, [appealId]);
            await insertAppealPhotos(appealId, imageUrls);
        }

        const updated = await fetchWithParticipants([appealId]);
        return res.json(updated[0]);
    } catch (err) {
        console.error("[appeals PATCH]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// DELETE /api/appeals/:id
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

// POST /api/appeals/:id/archive — вручную отправить в архив
router.post("/:id/archive", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const appealId = Number(req.params.id);
    try {
        const [[appeal]] = await pool.query<RowDataPacket[]>(
            `SELECT id, user_id, status FROM appeals WHERE id = ?`, [appealId],
        );
        if (!appeal) return res.status(404).json({ error: "Обращение не найдено" });
        if (Number(appeal.user_id) !== userId)
            return res.status(403).json({ error: "Нет прав" });
        if (!["resolved", "rejected"].includes(appeal.status as string))
            return res.status(400).json({ error: "Архивировать можно только решённые или отклонённые обращения" });

        await pool.execute(
            `UPDATE appeals SET manually_archived = 1 WHERE id = ?`, [appealId],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[appeals archive]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
