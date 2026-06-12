import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const router = Router();

const VALID_DOC_TYPES = ["lease", "ownership"];

// GET /api/apartments — список квартир пользователя со статусом верификации из verification_requests
router.get("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                ua.id,
                ua.building_key,
                COALESCE(b.short_name, ua.building_key) AS building_name,
                ua.apartment,
                ua.entrance,
                ua.apartment_area_sqm,
                ua.created_at,
                vr.doc_type,
                COALESCE(vr.status, 'none')  AS verification_status,
                vr.comment                   AS reviewer_comment,
                vr.submitted_at,
                up.active_apartment_id
             FROM user_apartments ua
             LEFT JOIN buildings b ON b.building_key = ua.building_key
             JOIN user_profiles up ON up.user_id = ua.user_id
             LEFT JOIN verification_requests vr ON vr.id = (
                 SELECT id FROM verification_requests vr2
                 WHERE vr2.apartment_id = ua.id
                 ORDER BY vr2.submitted_at DESC
                 LIMIT 1
             )
             WHERE ua.user_id = ?
             ORDER BY ua.created_at ASC`,
            [userId],
        );

        const activeId = rows[0]?.active_apartment_id ?? null;
        return res.json(rows.map((r) => ({
            id: String(r.id),
            buildingKey: r.building_key as string,
            buildingName: r.building_name as string,
            apartment: r.apartment as string,
            entrance: r.entrance as number | null,
            apartmentAreaSqm: r.apartment_area_sqm as number | null,
            docType: (r.doc_type as string | null) ?? null,
            verificationStatus: r.verification_status as string,
            reviewerComment: (r.reviewer_comment as string | null) ?? null,
            submittedAt: r.submitted_at ? (r.submitted_at as Date).toISOString() : null,
            isActive: String(r.id) === String(activeId),
        })));
    } catch (err) {
        console.error("[apartments GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/apartments — добавить квартиру + создать заявку на верификацию
router.post("/", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { buildingKey, apartment, entrance, apartmentAreaSqm, docType, docUrls } =
        req.body as {
            buildingKey?: string;
            apartment?: string;
            entrance?: number;
            apartmentAreaSqm?: number;
            docType?: string;
            docUrls?: string[];
        };

    if (!buildingKey || !apartment?.trim()) {
        return res.status(400).json({ error: "Укажите дом и номер квартиры" });
    }
    if (!docType || !VALID_DOC_TYPES.includes(docType)) {
        return res.status(400).json({ error: "Некорректный тип документа" });
    }
    if (!docUrls?.length) {
        return res.status(400).json({ error: "Фото документа обязательно" });
    }

    try {
        // Проверяем, что здание существует
        const [[building]] = await pool.query<RowDataPacket[]>(
            `SELECT building_key, short_name FROM buildings WHERE building_key = ? AND is_active = 1`,
            [buildingKey],
        );
        if (!building) {
            return res.status(404).json({ error: "Дом не найден" });
        }

        // Нельзя добавить ту же квартиру дважды
        const [[dup]] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM user_apartments WHERE user_id = ? AND building_key = ? AND apartment = ?`,
            [userId, buildingKey, apartment.trim()],
        );
        if (dup) {
            return res.status(409).json({ error: "Эта квартира уже добавлена" });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Создаём запись квартиры
            const [aptResult] = await conn.execute<ResultSetHeader>(
                `INSERT INTO user_apartments (user_id, building_key, apartment, entrance, apartment_area_sqm)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, buildingKey, apartment.trim(), entrance ?? null, apartmentAreaSqm ?? null],
            );
            const newAptId = aptResult.insertId;

            // 2. Создаём заявку на верификацию в той же таблице, что и основная верификация
            const [vrResult] = await conn.execute<ResultSetHeader>(
                `INSERT INTO verification_requests
                     (apartment_id, doc_type, status, submitted_at)
                 VALUES (?, ?, 'pending', NOW())`,
                [newAptId, docType],
            );
            for (let i = 0; i < docUrls.length; i++) {
                await conn.execute(
                    `INSERT INTO verification_photos (request_id, image_url, position) VALUES (?, ?, ?)`,
                    [vrResult.insertId, docUrls[i], i],
                );
            }

            await conn.commit();

            return res.status(201).json({
                id: String(newAptId),
                buildingKey,
                buildingName: building.short_name as string,
                apartment: apartment.trim(),
                entrance: entrance ?? null,
                apartmentAreaSqm: apartmentAreaSqm ?? null,
                docType,
                verificationStatus: "pending",
                reviewerComment: null,
                submittedAt: new Date().toISOString(),
                isActive: false,
            });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error("[apartments POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// PATCH /api/apartments/:id/activate — переключить активную квартиру
router.patch("/:id/activate", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const aptId = Number(req.params.id);

    if (!aptId || isNaN(aptId)) {
        return res.status(400).json({ error: "Некорректный ID квартиры" });
    }

    try {
        const [[apt]] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM user_apartments WHERE id = ? AND user_id = ?`,
            [aptId, userId],
        );
        if (!apt) {
            return res.status(404).json({ error: "Квартира не найдена" });
        }

        await pool.execute(
            `UPDATE user_profiles SET active_apartment_id = ? WHERE user_id = ?`,
            [aptId, userId],
        );

        return res.json({ ok: true });
    } catch (err) {
        console.error("[apartments PATCH activate]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// DELETE /api/apartments/:id — удалить квартиру
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const aptId = Number(req.params.id);

    if (!aptId || isNaN(aptId)) {
        return res.status(400).json({ error: "Некорректный ID квартиры" });
    }

    try {
        const [[countRow]] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS cnt FROM user_apartments WHERE user_id = ?`,
            [userId],
        );
        if ((countRow?.cnt as number) <= 1) {
            return res.status(400).json({ error: "Нельзя удалить единственную квартиру" });
        }

        const [[apt]] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM user_apartments WHERE id = ? AND user_id = ?`,
            [aptId, userId],
        );
        if (!apt) {
            return res.status(404).json({ error: "Квартира не найдена" });
        }

        // Если удаляемая — активная, переключаем на другую
        const [[profile]] = await pool.query<RowDataPacket[]>(
            `SELECT active_apartment_id FROM user_profiles WHERE user_id = ?`,
            [userId],
        );
        if (String(profile?.active_apartment_id) === String(aptId)) {
            const [[other]] = await pool.query<RowDataPacket[]>(
                `SELECT id FROM user_apartments WHERE user_id = ? AND id != ? LIMIT 1`,
                [userId, aptId],
            );
            if (other) {
                await pool.execute(
                    `UPDATE user_profiles SET active_apartment_id = ? WHERE user_id = ?`,
                    [other.id, userId],
                );
            }
        }

        await pool.execute(`DELETE FROM user_apartments WHERE id = ? AND user_id = ?`, [aptId, userId]);

        return res.json({ ok: true });
    } catch (err) {
        console.error("[apartments DELETE]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
