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

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT n.id, n.title, n.body, n.type, n.created_at,
                    (nr.user_id IS NOT NULL) AS is_read
             FROM notifications n
             LEFT JOIN user_notification_reads nr
                   ON nr.notification_id = n.id AND nr.user_id = ?
             WHERE n.building_key IS NULL
                OR LOWER(n.building_key) = LOWER(?)
             ORDER BY n.created_at DESC
             LIMIT 100`,
            [userId, buildingKey ?? ""],
        );

        return res.json(rows.map((r) => ({
            id: String(r.id),
            title: String(r.title),
            body: String(r.body),
            type: r.type as string,
            date: (r.created_at as Date).toISOString(),
            read: Boolean(r.is_read),
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
            `SELECT id FROM notifications WHERE id = ?`, [notifId],
        );
        if (!exists) return res.status(404).json({ error: "Уведомление не найдено" });

        await pool.execute(
            `INSERT IGNORE INTO user_notification_reads (notification_id, user_id) VALUES (?, ?)`,
            [notifId, userId],
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
        const buildingKey = await getActiveBuildingKey(userId);
        await pool.execute(
            `INSERT IGNORE INTO user_notification_reads (notification_id, user_id)
             SELECT n.id, ? FROM notifications n
             WHERE (n.building_key IS NULL OR LOWER(n.building_key) = LOWER(?))
               AND NOT EXISTS (
                   SELECT 1 FROM user_notification_reads nr2
                   WHERE nr2.notification_id = n.id AND nr2.user_id = ?
               )`,
            [userId, buildingKey ?? "", userId],
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
            `UPDATE users SET expo_push_token = ? WHERE id = ?`,
            [token, req.userId!],
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error("[push-token save]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
