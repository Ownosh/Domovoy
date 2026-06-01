import { Router } from "express";
import { pool } from "../db/client";
import { RowDataPacket } from "mysql2";

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

export default router;