import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { moderateContent } from "../utils/moderation";
import { getActiveApartment, getActiveBuildingKey, voteEffectiveStatus, VOTE_BUILDING_KEY_EXPR, isApartmentOwner } from "../db/helpers";

const router = Router();

// GET /api/votes  — голосования дома + голоса текущего пользователя
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const buildingKey = await getActiveBuildingKey(userId);
        if (!buildingKey) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [voteRows] = await pool.query<RowDataPacket[]>(
            `SELECT v.id, ${VOTE_BUILDING_KEY_EXPR} AS building_key, author_ua.user_id, v.sponsor, v.topic, v.description,
                    v.visibility, v.ends_at, v.closed, v.trial, v.moderation_status, v.created_at,
                    p.full_name AS author_name, p.profile_photo AS author_photo,
                    author_ua.apartment AS author_apartment
             FROM votes v
             LEFT JOIN user_apartments author_ua ON author_ua.id = v.author_apartment_id
             LEFT JOIN user_profiles p ON p.user_id = author_ua.user_id
             WHERE LOWER(${VOTE_BUILDING_KEY_EXPR}) = ?
             ORDER BY v.created_at DESC`,
            [buildingKey.toLowerCase()],
        );

        const votes: any[] = [];
        const openVoteIds: number[] = [];
        for (const v of voteRows) {
            const [opts] = await pool.query<RowDataPacket[]>(
                `SELECT id, label FROM vote_options WHERE vote_id = ? ORDER BY position`,
                [v.id],
            );
            const visibility = (v.visibility as string) ?? "open";
            if (visibility === "open") openVoteIds.push(Number(v.id));
            votes.push({
                id: String(v.id),
                buildingKey: v.building_key as string,
                userId: v.user_id != null ? String(v.user_id) : undefined,
                sponsor: v.sponsor as string,
                topic: String(v.topic),
                description: String(v.description ?? ""),
                visibility,
                endsAt: (v.ends_at as Date).toISOString(),
                closed: Boolean(v.closed),
                status: voteEffectiveStatus({
                    moderation_status: v.moderation_status as string,
                    closed: v.closed,
                    ends_at: v.ends_at as Date,
                }),
                trial: Boolean(v.trial),
                createdAt: (v.created_at as Date).toISOString(),
                options: opts.map((o) => ({ id: String(o.id), label: String(o.label) })),
                authorName: (v.author_name as string | null) ?? undefined,
                authorPhoto: (v.author_photo as string | null) ?? undefined,
                createdByLabel: (() => {
                    const name = (v.author_name as string | null) ?? null;
                    const apt = (v.author_apartment as string | null) ?? null;
                    if (!name && !apt) return "";
                    if (name && apt) return `${name}, кв. ${apt}`;
                    return apt ? `Кв. ${apt}` : String(name ?? "");
                })(),
            });
        }

        const hasOpen = openVoteIds.length > 0;
        const [castRows] = await pool.query<RowDataPacket[]>(
            hasOpen
                ? `SELECT vc.vote_id, vc.apartment_id, ua.user_id, vc.option_id, vc.voted_at
                   FROM vote_casts vc
                   JOIN user_apartments ua ON ua.id = vc.apartment_id
                   WHERE vc.vote_id IN (?) OR ua.user_id = ?`
                : `SELECT vc.vote_id, vc.apartment_id, ua.user_id, vc.option_id, vc.voted_at
                   FROM vote_casts vc
                   JOIN user_apartments ua ON ua.id = vc.apartment_id
                   WHERE ua.user_id = ?`,
            hasOpen ? [openVoteIds, userId] : [userId],
        );
        const casts = castRows.map((c) => ({
            voteId: String(c.vote_id),
            apartmentId: String(c.apartment_id),
            userId: String((c as { user_id?: number }).user_id ?? userId),
            optionId: String(c.option_id),
            votedAt: (c.voted_at as Date).toISOString(),
        }));

        return res.json({ votes, casts });
    } catch (err) {
        console.error("[votes GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/votes  — создать голосование
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { topic, description, visibility, optionLabels, durationDays } =
        req.body as {
            topic?: string;
            description?: string;
            visibility?: string;
            optionLabels?: string[];
            durationDays?: number;
        };

    if (!topic?.trim() || !description?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    if (!Array.isArray(optionLabels) || optionLabels.length < 2 || optionLabels.length > 4)
        return res.status(400).json({ error: "Нужно 2–4 варианта ответа" });
    if (![3, 7, 14].includes(Number(durationDays)))
        return res.status(400).json({ error: "Срок: 3, 7 или 14 дней" });

    try {
        const mod = await moderateContent("vote", { topic: topic.trim(), description: description.trim(), options: optionLabels.map((o) => o.trim()) });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const buildingKey = await getActiveBuildingKey(userId);
        if (!buildingKey) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const apt = await getActiveApartment(userId);
        if (!apt) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const endsAt = new Date(Date.now() + Number(durationDays) * 86400_000);
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [vr] = await conn.execute<ResultSetHeader>(
                `INSERT INTO votes (author_apartment_id, sponsor, topic, description, visibility, ends_at)
                 VALUES (?, 'residents', ?, ?, ?, ?)`,
                [apt.apartmentId, topic.trim(), description.trim(), visibility ?? "open", endsAt],
            );
            const voteId = vr.insertId;
            const optionIds: number[] = [];
            for (let i = 0; i < optionLabels.length; i++) {
                const [or] = await conn.execute<ResultSetHeader>(
                    `INSERT INTO vote_options (vote_id, label, position) VALUES (?, ?, ?)`,
                    [voteId, optionLabels[i].trim(), i],
                );
                optionIds.push(or.insertId);
            }
            await conn.commit();

            const [[authorRow]] = await pool.query<RowDataPacket[]>(
                `SELECT p.full_name AS author_name, ua.apartment AS author_apartment
                 FROM user_apartments ua
                 LEFT JOIN user_profiles p ON p.user_id = ua.user_id
                 WHERE ua.id = ?`,
                [apt.apartmentId],
            );
            const authorName = (authorRow?.author_name as string | null) ?? null;
            const authorApartment = (authorRow?.author_apartment as string | null) ?? null;
            const createdByLabel =
                authorName && authorApartment
                    ? `${authorName}, кв. ${authorApartment}`
                    : authorApartment
                      ? `Кв. ${authorApartment}`
                      : authorName ?? "";

            return res.status(201).json({
                id: String(voteId),
                buildingKey,
                userId: String(userId),
                createdByLabel,
                sponsor: "residents",
                topic: topic.trim(),
                description: description.trim(),
                visibility: visibility ?? "open",
                endsAt: endsAt.toISOString(),
                closed: false,
                status: "active",
                trial: false,
                createdAt: new Date().toISOString(),
                options: optionLabels.map((label, i) => ({
                    id: String(optionIds[i]),
                    label: label.trim(),
                })),
            });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error("[votes POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// PATCH /api/votes/:id  — редактировать голосование (сбрасывает все голоса)
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const voteId = Number(req.params.id);
    const { topic, description, visibility, optionLabels } = req.body as {
        topic?: string; description?: string; visibility?: string; optionLabels?: string[];
    };

    if (!topic?.trim() || !description?.trim())
        return res.status(400).json({ error: "Тема и описание обязательны" });
    if (!Array.isArray(optionLabels) || optionLabels.length < 2 || optionLabels.length > 4)
        return res.status(400).json({ error: "Нужно 2–4 варианта ответа" });

    try {
        const mod = await moderateContent("vote", { topic: topic.trim(), description: description.trim(), options: optionLabels.map((o) => o.trim()) });
        if (!mod.ok) {
            return res.status(422).json({
                error: mod.issue,
                moderation: { field: mod.field, issue: mod.issue, suggestion: mod.suggestion },
            });
        }

        const [[vote]] = await pool.query<RowDataPacket[]>(
            `SELECT v.id FROM votes v
             JOIN user_apartments ua ON ua.id = v.author_apartment_id
             WHERE v.id = ? AND ua.user_id = ?`,
            [voteId, userId],
        );
        if (!vote) return res.status(404).json({ error: "Голосование не найдено" });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute(
                `UPDATE votes SET topic=?, description=?, visibility=?, closed=0 WHERE id=?`,
                [topic.trim(), description.trim(), visibility ?? "open", voteId],
            );
            await conn.execute(`DELETE FROM vote_casts WHERE vote_id=?`, [voteId]);
            await conn.execute(`DELETE FROM vote_options WHERE vote_id=?`, [voteId]);
            const optionIds: number[] = [];
            for (let i = 0; i < optionLabels.length; i++) {
                const [or] = await conn.execute<ResultSetHeader>(
                    `INSERT INTO vote_options (vote_id, label, position) VALUES (?, ?, ?)`,
                    [voteId, optionLabels[i].trim(), i],
                );
                optionIds.push(or.insertId);
            }
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        const [[updated]] = await pool.query<RowDataPacket[]>(
            `SELECT v.id, ${VOTE_BUILDING_KEY_EXPR} AS building_key, author_ua.user_id, v.sponsor, v.topic, v.description,
                    v.visibility, v.ends_at, v.closed, v.trial, v.moderation_status, v.created_at,
                    p.full_name AS author_name, author_ua.apartment AS author_apartment
             FROM votes v
             LEFT JOIN user_apartments author_ua ON author_ua.id = v.author_apartment_id
             LEFT JOIN user_profiles p ON p.user_id = author_ua.user_id
             WHERE v.id=?`,
            [voteId],
        );
        const [opts] = await pool.query<RowDataPacket[]>(
            `SELECT id, label FROM vote_options WHERE vote_id=? ORDER BY position`, [voteId],
        );

        const authorName = (updated.author_name as string | null) ?? null;
        const authorApartment = (updated.author_apartment as string | null) ?? null;
        const createdByLabel =
            authorName && authorApartment
                ? `${authorName}, кв. ${authorApartment}`
                : authorApartment
                  ? `Кв. ${authorApartment}`
                  : authorName ?? "";

        return res.json({
            id: String(updated.id),
            buildingKey: updated.building_key as string,
            userId: updated.user_id != null ? String(updated.user_id) : undefined,
            createdByLabel,
            sponsor: updated.sponsor as string,
            topic: String(updated.topic),
            description: String(updated.description ?? ""),
            visibility: updated.visibility as string,
            endsAt: (updated.ends_at as Date).toISOString(),
            closed: false,
            status: voteEffectiveStatus({
                moderation_status: updated.moderation_status as string,
                closed: false,
                ends_at: updated.ends_at as Date,
            }),
            trial: Boolean(updated.trial),
            createdAt: (updated.created_at as Date).toISOString(),
            options: opts.map((o) => ({ id: String(o.id), label: String(o.label) })),
        });
    } catch (err) {
        console.error("[votes PATCH]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/votes/:id/report  — пожаловаться на голосование (отправить на проверку админу)
router.post("/:id/report", requireAuth, async (req: AuthRequest, res) => {
    const voteId = Number(req.params.id);
    try {
        await pool.execute(
            `UPDATE votes SET moderation_status = 'under_review'
             WHERE id = ? AND moderation_status NOT IN ('under_review', 'cancelled')`,
            [voteId],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[votes/report POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// DELETE /api/votes/:id  — удалить голосование
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const voteId = Number(req.params.id);
    try {
        const [[vote]] = await pool.query<RowDataPacket[]>(
            `SELECT v.id FROM votes v
             JOIN user_apartments ua ON ua.id = v.author_apartment_id
             WHERE v.id=? AND ua.user_id=?`,
            [voteId, userId],
        );
        if (!vote) return res.status(404).json({ error: "Голосование не найдено или нет прав" });
        await pool.execute(`DELETE FROM votes WHERE id=?`, [voteId]);
        return res.json({ ok: true });
    } catch (err) {
        console.error("[votes DELETE]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/votes/:id/cast  — проголосовать
router.post("/:id/cast", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const voteId = Number(req.params.id);
    const { optionId } = req.body as { optionId?: string };
    if (!optionId) return res.status(400).json({ error: "optionId обязателен" });

    try {
        const apt = await getActiveApartment(userId);
        if (!apt) return res.status(400).json({ error: "Профиль не привязан к дому" });

        if (!(await isApartmentOwner(apt.apartmentId))) {
            return res.status(403).json({
                error: "Голосовать могут только собственники с подтверждённым правом собственности",
            });
        }

        const [[vote]] = await pool.query<RowDataPacket[]>(
            `SELECT v.ends_at, v.closed, v.moderation_status
             FROM votes v
             LEFT JOIN user_apartments author_ua ON author_ua.id = v.author_apartment_id
             WHERE v.id = ? AND LOWER(${VOTE_BUILDING_KEY_EXPR}) = LOWER(?)`,
            [voteId, apt.buildingKey],
        );
        if (!vote) return res.status(404).json({ error: "Голосование не найдено" });
        if (vote.moderation_status === "cancelled")
            return res.status(400).json({ error: "Голосование отменено" });
        if (vote.closed || new Date(vote.ends_at as string) <= new Date())
            return res.status(400).json({ error: "Срок голосования истёк" });

        const [[opt]] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM vote_options WHERE id = ? AND vote_id = ?`, [optionId, voteId],
        );
        if (!opt) return res.status(400).json({ error: "Некорректный вариант" });

        const [[existingCast]] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM vote_casts WHERE vote_id = ? AND apartment_id = ?`,
            [voteId, apt.apartmentId],
        );
        if (existingCast) {
            return res.status(409).json({ error: "Эта квартира уже проголосовала в данном голосовании" });
        }

        await pool.execute(
            `INSERT INTO vote_casts (vote_id, option_id, apartment_id) VALUES (?, ?, ?)`,
            [voteId, optionId, apt.apartmentId],
        );
        return res.json({ ok: true });
    } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "ER_DUP_ENTRY")
            return res.status(409).json({ error: "Эта квартира уже проголосовала в данном голосовании" });
        if (code === "45000")
            return res.status(400).json({ error: "Голосование недоступно для вашего дома" });
        console.error("[votes/cast POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
