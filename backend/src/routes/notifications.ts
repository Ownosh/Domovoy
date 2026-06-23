import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket } from "mysql2";
import { getActiveBuildingKey } from "../db/helpers";

const router = Router();

type NotificationPrefsBody = {
    outages?: boolean;
    meetings?: boolean;
    announcements?: boolean;
    general?: boolean;
};

function prefsFromRow(r: RowDataPacket) {
    return {
        outages: Boolean(r.notif_outages),
        meetings: Boolean(r.notif_meetings),
        announcements: Boolean(r.notif_announcements),
        general: Boolean(r.notif_general),
    };
}

function notificationScopeSql(buildingKey: string | null): { sql: string; params: string[] } {
    return {
        sql: `(n.building_key IS NULL OR LOWER(n.building_key) = LOWER(?))`,
        params: [buildingKey ?? ""],
    };
}

// GET /api/notifications
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const buildingKey = await getActiveBuildingKey(userId);
        const scope = notificationScopeSql(buildingKey);

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT n.id, n.title, n.body, n.type, n.created_at,
                    (unr.notification_id IS NOT NULL) AS is_read
             FROM notifications n
             LEFT JOIN user_notification_reads unr
                ON unr.notification_id = n.id AND unr.user_id = ?
             WHERE ${scope.sql}
             ORDER BY n.created_at DESC
             LIMIT 100`,
            [userId, ...scope.params],
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

// GET /api/notifications/prefs
router.get("/prefs", requireAuth, async (req: AuthRequest, res) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT notif_outages, notif_meetings, notif_announcements, notif_general
             FROM users WHERE id = ? AND is_active = 1`,
            [req.userId!],
        );
        if (!rows[0]) return res.status(404).json({ error: "Пользователь не найден" });
        return res.json(prefsFromRow(rows[0]));
    } catch (err) {
        console.error("[notifications prefs GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// PATCH /api/notifications/prefs
router.patch("/prefs", requireAuth, async (req: AuthRequest, res) => {
    const body = req.body as NotificationPrefsBody;
    const fields: Array<keyof NotificationPrefsBody> = [
        "outages",
        "meetings",
        "announcements",
        "general",
    ];
    const updates: string[] = [];
    const params: boolean[] = [];

    for (const key of fields) {
        if (body[key] !== undefined) {
            if (typeof body[key] !== "boolean") {
                return res.status(400).json({ error: `Поле ${key} должно быть boolean` });
            }
            const column =
                key === "outages"
                    ? "notif_outages"
                    : key === "meetings"
                      ? "notif_meetings"
                      : key === "announcements"
                        ? "notif_announcements"
                        : "notif_general";
            updates.push(`${column} = ?`);
            params.push(body[key]!);
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: "Нет полей для обновления" });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE users SET ${updates.join(", ")} WHERE id = ? AND is_active = 1`,
            [...params, req.userId!],
        );
        if ((result as { affectedRows: number }).affectedRows === 0) {
            return res.status(404).json({ error: "Пользователь не найден" });
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT notif_outages, notif_meetings, notif_announcements, notif_general
             FROM users WHERE id = ?`,
            [req.userId!],
        );
        return res.json(prefsFromRow(rows[0]));
    } catch (err) {
        console.error("[notifications prefs PATCH]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/notifications/:id/read
router.post("/:id/read", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const notifId = Number(req.params.id);
    if (!notifId || isNaN(notifId)) return res.status(400).json({ error: "Некорректный id" });
    try {
        const buildingKey = await getActiveBuildingKey(userId);
        const scope = notificationScopeSql(buildingKey);

        const [[exists]] = await pool.query<RowDataPacket[]>(
            `SELECT n.id FROM notifications n
             WHERE n.id = ? AND ${scope.sql}`,
            [notifId, ...scope.params],
        );
        if (!exists) return res.status(404).json({ error: "Уведомление не найдено" });

        await pool.execute(
            `INSERT INTO user_notification_reads (user_id, notification_id, read_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE read_at = read_at`,
            [userId, notifId],
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
        const scope = notificationScopeSql(buildingKey);

        await pool.execute(
            `INSERT INTO user_notification_reads (user_id, notification_id, read_at)
             SELECT ?, n.id, NOW()
             FROM notifications n
             WHERE ${scope.sql}
             ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)`,
            [userId, ...scope.params],
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
