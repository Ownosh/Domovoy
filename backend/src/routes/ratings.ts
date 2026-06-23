import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { getActiveApartment } from "../db/helpers";

const router = Router();

// GET /api/ratings/my — оценка текущего пользователя за указанный или текущий месяц
router.get("/my", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const monthKey = String(req.query.month ?? "");
    try {
        const apt = await getActiveApartment(userId);
        if (!apt) return res.json(null);

        let sql = `SELECT month_key, courtyard_stars, entrance_stars, uk_stars,
                          feedback_other, submitted_at
                   FROM environment_ratings WHERE apartment_id = ?`;
        const params: unknown[] = [apt.apartmentId];
        if (monthKey) {
            sql += ` AND month_key = ?`;
            params.push(monthKey);
        } else {
            sql += ` ORDER BY month_key DESC LIMIT 1`;
        }
        const [[row]] = await pool.query<RowDataPacket[]>(sql, params);
        if (!row) return res.json(null);

        return res.json({
            monthKey: row.month_key as string,
            courtyardStars: Number(row.courtyard_stars),
            entranceStars: Number(row.entrance_stars),
            ukStars: Number(row.uk_stars),
            feedbackOther: (row.feedback_other as string | null) ?? undefined,
            submittedAt: (row.submitted_at as Date).toISOString(),
        });
    } catch (err) {
        console.error("[ratings GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/ratings — сохранить оценку (один раз в месяц)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { monthKey, courtyardStars, entranceStars, ukStars, feedbackOther } =
        req.body as {
            monthKey?: string;
            courtyardStars?: number;
            entranceStars?: number;
            ukStars?: number;
            feedbackOther?: string;
        };

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey))
        return res.status(400).json({ error: "Некорректный месяц (YYYY-MM)" });
    if (![1,2,3,4,5].includes(Number(courtyardStars)) ||
        ![1,2,3,4,5].includes(Number(entranceStars)) ||
        ![1,2,3,4,5].includes(Number(ukStars)))
        return res.status(400).json({ error: "Оценки должны быть от 1 до 5" });

    try {
        const apt = await getActiveApartment(userId);
        if (!apt) return res.status(400).json({ error: "Профиль не привязан к дому" });

        await pool.execute<ResultSetHeader>(
            `INSERT INTO environment_ratings
                (apartment_id, month_key, courtyard_stars, entrance_stars, uk_stars, feedback_other)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                courtyard_stars = VALUES(courtyard_stars),
                entrance_stars  = VALUES(entrance_stars),
                uk_stars        = VALUES(uk_stars),
                feedback_other  = VALUES(feedback_other),
                submitted_at    = NOW()`,
            [
                apt.apartmentId, monthKey,
                Number(courtyardStars), Number(entranceStars), Number(ukStars),
                feedbackOther?.trim() || null,
            ],
        );

        return res.json({ ok: true });
    } catch (err) {
        console.error("[ratings POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/ratings/stats — агрегированные оценки дома для публичной статистики УК
router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const apt = await getActiveApartment(userId);
        if (!apt) return res.status(400).json({ error: "Профиль не привязан к дому" });

        const [[row]] = await pool.query<RowDataPacket[]>(
            `SELECT
                ROUND(AVG(er.courtyard_stars), 1) AS avg_courtyard,
                ROUND(AVG(er.entrance_stars),  1) AS avg_entrance,
                ROUND(AVG(er.uk_stars),        1) AS avg_uk,
                COUNT(*)                        AS ratings_count
             FROM environment_ratings er
             JOIN user_apartments ua ON ua.id = er.apartment_id
             WHERE LOWER(ua.building_key) = LOWER(?)`,
            [apt.buildingKey],
        );

        return res.json({
            avgCourtyardStars: row?.avg_courtyard != null ? Number(row.avg_courtyard) : null,
            avgEntranceStars:  row?.avg_entrance  != null ? Number(row.avg_entrance)  : null,
            avgUkStars:        row?.avg_uk         != null ? Number(row.avg_uk)        : null,
            ratingsCount:      Number(row?.ratings_count ?? 0),
        });
    } catch (err) {
        console.error("[ratings/stats GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
