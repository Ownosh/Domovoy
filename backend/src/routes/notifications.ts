import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket } from "mysql2";
import { getActiveBuildingKey } from "../db/helpers";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const buildingKey = await getActiveBuildingKey(userId);

        const [[u]] = await pool.query<RowDataPacket[]>(
            `SELECT notifications_last_seen_at FROM users WHERE id = ?`,
            [userId],
        );
        const lastSeen = u?.notifications_last_seen_at as Date | null | undefined;

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT n.id, n.title, n.body, n.type, n.created_at
             FROM notifications n
             WHERE n.building_key IS NULL
                OR LOWER(n.building_key) = LOWER(?)
             ORDER BY n.created_at DESC
             LIMIT 100`,
            [buildingKey ?? ""],
        );

        return res.json(rows.map((r) => ({
            id: String(r.id),
            title: String(r.title),
            body: String(r.body),
            type: r.type as string,
            date: (r.created_at as Date).toISOString(),
            read: lastSeen ? (r.created_at as Date) <= lastSeen : false,
        })));
    } catch (err) {
        console.error("[notifications GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/notifications/:id/read
router.post("/:id/read", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const notifId = Number(req.params.id);
    if (!notifId || isNaN(notifId)) return res.status(400).json({ error: "Некорректный id" });
    try {
        const [[exists]] = await pool.query<RowDataPacket[]>(
            `SELECT id, created_at FROM notifications WHERE id = ?`, [notifId],
        );
        if (!exists) return res.status(404).json({ error: "Уведомление не найдено" });

        const createdAt = exists.created_at as Date;
        await pool.execute(
            `UPDATE users
             SET notifications_last_seen_at =
                CASE
                    WHEN notifications_last_seen_at IS NULL THEN ?
                    WHEN notifications_last_seen_at < ? THEN ?
                    ELSE notifications_last_seen_at
                END
             WHERE id = ?`,
            [createdAt, createdAt, createdAt, userId],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[notifications read]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/notifications/read-all
router.post("/read-all", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        await pool.execute(
            `UPDATE users SET notifications_last_seen_at = NOW() WHERE id = ?`,
            [userId],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[notifications read-all]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/notifications/push-token
router.post("/push-token", requireAuth, async (req: AuthRequest, res) => {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ error: "token обязателен" });
    try {
        await pool.execute(
            `INSERT INTO push_tokens (user_id, token, platform) VALUES (?, ?, 'expo')
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), created_at = CURRENT_TIMESTAMP`,
            [req.userId!, token],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[push-token save]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
