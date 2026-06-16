import { Router } from "express";
import { pool } from "../db/client";
import { RowDataPacket } from "mysql2";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getActiveBuildingKey } from "../db/helpers";

const router = Router();

router.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();

    if (q.length < 2) {
        return res.json([]);
    }

    try {
        const like = `%${q}%`;
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT building_key, short_name, address
             FROM buildings
             WHERE is_active = TRUE
               AND (short_name LIKE ? OR address LIKE ?)
             ORDER BY short_name
             LIMIT 10`,
            [like, like],
        );
        return res.json(rows);
    } catch (err) {
        console.error("buildings/search error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/buildings/info — данные дома текущего пользователя
router.get("/info", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const buildingKey = await getActiveBuildingKey(userId);
        if (!buildingKey) return res.status(404).json({ error: "Дом не найден" });

        const [[b]] = await pool.query<RowDataPacket[]>(
            `SELECT building_key, address, short_name, city, year_built, entrances, apartments
             FROM buildings WHERE LOWER(building_key) = LOWER(?)`,
            [buildingKey],
        );
        if (!b) return res.status(404).json({ error: "Дом не найден в базе" });

        return res.json({
            buildingKey: b.building_key,
            address: b.address,
            shortName: b.short_name,
            city: b.city ?? "",
            yearBuilt: b.year_built ?? null,
            entrances: b.entrances ?? null,
            apartments: b.apartments ?? null,
        });
    } catch (err) {
        console.error("buildings/info error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/buildings/photos
router.get("/photos", requireAuth, async (req: AuthRequest, res) => {
    const key = await getActiveBuildingKey(req.userId!);
    if (!key) return res.status(404).json({ error: "Дом не найден" });
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT url FROM media
             WHERE owner_type = 'building' AND LOWER(owner_key) = LOWER(?)
             ORDER BY position`,
            [key],
        );
        return res.json(rows.map((r) => r.url as string));
    } catch (err) {
        console.error("buildings/photos error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/buildings/specs
router.get("/specs", requireAuth, async (req: AuthRequest, res) => {
    const key = await getActiveBuildingKey(req.userId!);
    if (!key) return res.status(404).json({ error: "Дом не найден" });
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT label, value FROM house_specs WHERE LOWER(building_key) = LOWER(?) ORDER BY position`, [key],
        );
        return res.json(rows.map((r) => ({ label: r.label as string, value: r.value as string })));
    } catch (err) {
        console.error("buildings/specs error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

function toDateString(raw: unknown): string {
    if (raw instanceof Date) {
        const y = raw.getFullYear();
        const m = String(raw.getMonth() + 1).padStart(2, "0");
        const d = String(raw.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    return String(raw).slice(0, 10);
}

// GET /api/buildings/calendar?from=YYYY-MM&to=YYYY-MM
router.get("/calendar", requireAuth, async (req: AuthRequest, res) => {
    const key = await getActiveBuildingKey(req.userId!);
    if (!key) return res.status(404).json({ error: "Дом не найден" });

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, activity_date, title, kind FROM house_calendar_activities
             WHERE LOWER(building_key) = LOWER(?)
             ORDER BY activity_date`,
            [key],
        );

        return res.json(rows.map((r) => ({
            id: String(r.id),
            date: toDateString(r.activity_date),
            title: r.title as string,
            kind: r.kind as string,
        })));
    } catch (err) {
        console.error("buildings/calendar error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/buildings/schedule
router.get("/schedule", requireAuth, async (req: AuthRequest, res) => {
    const key = await getActiveBuildingKey(req.userId!);
    if (!key) return res.status(404).json({ error: "Дом не найден" });
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, title, schedule, note FROM trash_pickup_schedule WHERE LOWER(building_key) = LOWER(?) ORDER BY position`, [key],
        );
        return res.json(rows.map((r) => ({
            id: String(r.id),
            title: r.title as string,
            schedule: r.schedule as string,
            note: (r.note as string | null) ?? undefined,
        })));
    } catch (err) {
        console.error("buildings/schedule error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/buildings/status
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
    const key = await getActiveBuildingKey(req.userId!);
    if (!key) return res.status(404).json({ error: "Дом не найден" });
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, text, status FROM house_status
             WHERE LOWER(building_key) = LOWER(?) AND is_active = 1
             ORDER BY position`,
            [key],
        );
        return res.json(rows.map((r) => ({
            id: String(r.id),
            text: r.text as string,
            status: r.status as "ok" | "warning" | "danger",
        })));
    } catch (err) {
        console.error("buildings/status error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/buildings/contacts
router.get("/contacts", requireAuth, async (req: AuthRequest, res) => {
    const key = await getActiveBuildingKey(req.userId!);
    if (!key) return res.status(404).json({ error: "Дом не найден" });
    try {
        const [[row]] = await pool.query<RowDataPacket[]>(
            `SELECT mc.id AS mc_id, mc.company_name, mc.phone, mc.email, mc.site, mc.hours
             FROM buildings b
             LEFT JOIN management_companies mc ON mc.id = b.management_company_id
             WHERE LOWER(b.building_key) = LOWER(?)`,
            [key],
        );
        if (!row || row.mc_id == null) return res.json(null);
        return res.json({
            companyName: row.company_name as string,
            phone: row.phone as string,
            email: row.email as string,
            site: row.site as string,
            hours: row.hours as string,
        });
    } catch (err) {
        console.error("buildings/contacts error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// GET /api/buildings/chats
router.get("/chats", requireAuth, async (req: AuthRequest, res) => {
    const key = await getActiveBuildingKey(req.userId!);
    if (!key) return res.status(404).json({ error: "Дом не найден" });
    try {
        const [[b]] = await pool.query<RowDataPacket[]>(
            `SELECT chat_telegram_url, chat_vk_url, chat_max_url
             FROM buildings
             WHERE LOWER(building_key) = LOWER(?)`,
            [key],
        );
        if (!b) return res.json([]);
        const out: { platform: "telegram" | "vk" | "max"; url: string }[] = [];
        const tg = String(b.chat_telegram_url ?? "").trim();
        const vk = String(b.chat_vk_url ?? "").trim();
        const mx = String(b.chat_max_url ?? "").trim();
        if (tg) out.push({ platform: "telegram", url: tg });
        if (vk) out.push({ platform: "vk", url: vk });
        if (mx) out.push({ platform: "max", url: mx });
        return res.json(out);
    } catch (err) {
        console.error("buildings/chats error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;