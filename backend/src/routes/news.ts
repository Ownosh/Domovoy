import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket } from "mysql2";
import { getActiveBuildingKey } from "../db/helpers";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const buildingKey = await getActiveBuildingKey(userId);
        if (!buildingKey) {
            return res.status(400).json({ error: "Профиль не привязан к дому" });
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT n.id, n.building_key, n.title, n.excerpt, n.published_at,
                    GROUP_CONCAT(np.image_url ORDER BY np.position SEPARATOR '||') AS image_urls
             FROM news n
             LEFT JOIN news_photos np ON np.news_id = n.id
             WHERE n.building_key = ? AND n.is_published = 1
             GROUP BY n.id
             ORDER BY n.published_at DESC
             LIMIT 50`,
            [buildingKey],
        );

        const items = rows.map((r) => ({
            id: String(r.id),
            buildingKey: r.building_key as string,
            title: r.title as string,
            excerpt: r.excerpt as string,
            date: (() => { const raw = r.published_at; if (raw instanceof Date) { return `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,"0")}-${String(raw.getDate()).padStart(2,"0")}`; } return String(raw).slice(0, 10); })(),
            imageUrls: r.image_urls
                ? (r.image_urls as string).split("||").filter(Boolean)
                : [],
        }));
        console.log(`[news] user=${userId} building_key=${buildingKey} found=${items.length}`);
        return res.json(items);
    } catch (err) {
        console.error("news GET error:", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
