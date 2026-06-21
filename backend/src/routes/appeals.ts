import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { moderateContent } from "../utils/moderation";
import { getActiveApartment, isApartmentOwner } from "../db/helpers";

const router = Router();
const MASS_APPEAL_THRESHOLD = 5;
const OWNERS_MEETING_CATEGORY = "Инициатива собрания собственников";
const VALID_CATEGORIES = [
    "Аварийная ситуация", "Сантехника", "Электрика", "Отопление", "Вентиляция",
    "Уборка и благоустройство", "Нарушение порядка", OWNERS_MEETING_CATEGORY, "Другое",
];

async function getProfile(userId: number): Promise<{ apartmentId: number; buildingKey: string; apartment: string } | null> {
    const apt = await getActiveApartment(userId);
    if (!apt) return null;
    return {
        apartmentId: apt.apartmentId,
        buildingKey: apt.buildingKey,
        apartment: apt.apartment ?? "",
    };
}

async function getAppealPhotos(appealIds: number[]): Promise<Record<number, string[]>> {
    if (!appealIds.length) return {};
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT appeal_id, url
         FROM appeal_photos
         WHERE appeal_id IN (?)
         ORDER BY appeal_id, position`,
        [appealIds],
    );
    const map: Record<number, string[]> = {};
    for (const r of rows) {
        const id = Number(r.appeal_id);
        if (!map[id]) map[id] = [];
        map[id].push(r.url as string);
    }
    return map;
}

async function insertAppealPhotos(appealId: number, imageUrls: string[]): Promise<void> {
    for (let i = 0; i < imageUrls.length; i++) {
        await pool.execute(
            `INSERT IGNORE INTO appeal_photos (appeal_id, url, position) VALUES (?, ?, ?)`,
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
        buildingKey: String(v.building_key ?? ""),
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
        adminCommentRead: v.admin_comment_at
            ? Boolean(v.admin_comment_read_at && v.admin_comment_read_at >= v.admin_comment_at)
            : true,
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
        `SELECT a.id, author_ua.user_id, author_ua.building_key, a.title, a.body, a.category, a.kind, a.status,
                author_ua.entrance, author_ua.apartment AS author_apartment, a.escalated_to_uk, a.created_at,
                a.resolved_at, a.manually_archived, a.admin_comment, a.admin_comment_at, a.admin_comment_read_at,
                p.full_name AS author_name, p.profile_photo AS author_photo
         FROM appeals a
         JOIN user_apartments author_ua ON author_ua.id = a.author_apartment_id
         LEFT JOIN user_profiles p ON p.user_id = author_ua.user_id
         WHERE a.id IN (?) ORDER BY a.created_at DESC`,
        [appealIds],
    );
    const [parts] = await pool.query<RowDataPacket[]>(
        `SELECT ap.appeal_id, uap.user_id, uap.apartment, uap.entrance, p.full_name AS display_name,
                ap.anonymous, ap.comment, ap.photo_uri, ap.joined_at
         FROM appeal_participants ap
         JOIN user_apartments uap ON uap.id = ap.apartment_id
         LEFT JOIN user_profiles p ON p.user_id = uap.user_id
         WHERE ap.appeal_id IN (?)`,
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

async function isAppealAuthor(appealId: number, userId: number): Promise<boolean> {
    const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM appeals a
         JOIN user_apartments ua ON ua.id = a.author_apartment_id
         WHERE a.id = ? AND ua.user_id = ?`,
        [appealId, userId],
    );
    return Boolean(row);
}

// GET /api/appeals
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const prof = await getProfile(userId);
        if (!prof) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT a.id FROM appeals a
             JOIN user_apartments author_ua ON author_ua.id = a.author_apartment_id
             WHERE (a.kind = 'personal' AND author_ua.user_id = ?)
                OR (a.kind = 'collective' AND author_ua.building_key = ?)
             ORDER BY a.created_at DESC`,
            [userId, prof.buildingKey],
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
    const { title, body, category, kind, imageUrls } = req.body as {
        title?: string; body?: string; category?: string; kind?: string; imageUrls?: string[];
    };

    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    if (!["personal", "collective"].includes(kind ?? ""))
        return res.status(400).json({ error: "Некорректный тип обращения" });
    if (!VALID_CATEGORIES.includes(category?.trim() ?? ""))
        return res.status(400).json({ error: "Некорректная категория обращения" });

    try {
        const mod = await moderateContent("appeal", {
            title: title.trim(), body: body.trim(), category: category?.trim(),
        });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const prof = await getProfile(userId);
        if (!prof) return res.status(400).json({ error: "Профиль не привязан к дому" });

        if (category?.trim() === OWNERS_MEETING_CATEGORY) {
            if (kind !== "collective")
                return res.status(400).json({ error: "Инициатива собрания собственников может быть только коллективной" });
            if (!(await isApartmentOwner(prof.apartmentId)))
                return res.status(403).json({ error: "Подавать инициативу собрания собственников могут только верифицированные собственники" });
        }

        const initialStatus = kind === "collective" ? "collecting_signatures" : "new";
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO appeals (title, body, category, kind, author_apartment_id, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title.trim(), body.trim(), category?.trim() ?? "", kind!, prof.apartmentId, initialStatus],
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
    const { anonymous, comment, photoUri } = req.body as {
        anonymous?: boolean; comment?: string; photoUri?: string;
    };

    try {
        const prof = await getProfile(userId);
        if (!prof) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [[appeal]] = await pool.query<RowDataPacket[]>(
            `SELECT a.id, author_ua.building_key, author_ua.user_id AS author_user_id,
                    author_ua.entrance, a.category, a.kind, a.status, a.escalated_to_uk
             FROM appeals a
             JOIN user_apartments author_ua ON author_ua.id = a.author_apartment_id
             WHERE a.id = ?`,
            [appealId],
        );
        if (!appeal) return res.status(404).json({ error: "Обращение не найдено" });
        if (appeal.kind !== "collective") return res.status(400).json({ error: "Обращение не коллективное" });
        if (Number(appeal.author_user_id) === userId)
            return res.status(400).json({ error: "Нельзя присоединиться к своему обращению" });
        if ((appeal.building_key as string).toLowerCase() !== prof.buildingKey.toLowerCase())
            return res.status(400).json({ error: "Это обращение другого дома" });
        if (appeal.category === OWNERS_MEETING_CATEGORY && !(await isApartmentOwner(prof.apartmentId)))
            return res.status(403).json({ error: "Присоединиться к инициативе собрания собственников могут только верифицированные собственники" });

        try {
            await pool.execute(
                `INSERT INTO appeal_participants (appeal_id, apartment_id, anonymous, comment, photo_uri)
                 VALUES (?, ?, ?, ?, ?)`,
                [appealId, prof.apartmentId, anonymous ? 1 : 0, comment?.trim() || null, photoUri || null],
            );
        } catch (e: any) {
            if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Вы уже присоединились" });
            throw e;
        }

        if (!appeal.escalated_to_uk && !["resolved", "rejected"].includes(appeal.status as string)) {
            const authorEntrance = appeal.entrance != null ? Number(appeal.entrance) : null;
            const entranceCond = authorEntrance
                ? `AND (uap.entrance IS NULL OR uap.entrance = ${pool.escape(authorEntrance)})`
                : "";
            const [[countRow]] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(DISTINCT apt) AS cnt FROM (
                    SELECT author_ua.apartment AS apt
                    FROM appeals a
                    JOIN user_apartments author_ua ON author_ua.id = a.author_apartment_id
                    WHERE a.id = ?
                    UNION ALL
                    SELECT uap.apartment AS apt
                    FROM appeal_participants ap
                    JOIN user_apartments uap ON uap.id = ap.apartment_id
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
    const { title, body, category, imageUrls } = req.body as {
        title?: string; body?: string; category?: string; imageUrls?: string[];
    };
    if (!title?.trim() || !body?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    if (!VALID_CATEGORIES.includes(category?.trim() ?? ""))
        return res.status(400).json({ error: "Некорректная категория обращения" });
    try {
        const mod = await moderateContent("appeal", {
            title: title.trim(), body: body.trim(), category: category?.trim(),
        });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE appeals a
             JOIN user_apartments ua ON ua.id = a.author_apartment_id
             SET a.title=?, a.body=?, a.category=?, a.status='new', a.escalated_to_uk=0
             WHERE a.id=? AND ua.user_id=?`,
            [title.trim(), body.trim(), category?.trim() ?? "", appealId, userId],
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Обращение не найдено или нет прав" });
        await pool.execute(`DELETE FROM appeal_participants WHERE appeal_id=?`, [appealId]);

        if (Array.isArray(imageUrls)) {
            await pool.execute(`DELETE FROM appeal_photos WHERE appeal_id = ?`, [appealId]);
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
            `DELETE a FROM appeals a
             JOIN user_apartments ua ON ua.id = a.author_apartment_id
             WHERE a.id = ? AND ua.user_id = ?`,
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

// POST /api/appeals/:id/archive
router.post("/:id/archive", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const appealId = Number(req.params.id);
    try {
        const [[appeal]] = await pool.query<RowDataPacket[]>(
            `SELECT a.id, a.status FROM appeals a
             JOIN user_apartments ua ON ua.id = a.author_apartment_id
             WHERE a.id = ? AND ua.user_id = ?`,
            [appealId, userId],
        );
        if (!appeal) return res.status(404).json({ error: "Обращение не найдено" });
        if (!["resolved", "rejected"].includes(appeal.status as string))
            return res.status(400).json({ error: "Архивировать можно только решённые или отклонённые обращения" });

        await pool.execute(`UPDATE appeals SET manually_archived = 1 WHERE id = ?`, [appealId]);
        return res.json({ ok: true });
    } catch (err) {
        console.error("[appeals archive]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/appeals/:id/read-comment
router.post("/:id/read-comment", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const appealId = Number(req.params.id);
    try {
        if (!(await isAppealAuthor(appealId, userId)))
            return res.status(403).json({ error: "Нет прав" });

        await pool.execute(
            `UPDATE appeals SET admin_comment_read_at = NOW() WHERE id = ?`, [appealId],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[appeals read-comment]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
