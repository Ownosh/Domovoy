import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { getActiveApartment } from "../db/helpers";

const router = Router();

const VALID_DOC_TYPES = ["lease", "ownership"];

// GET /api/verification/status — текущий статус заявки для активной квартиры
router.get("/status", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    try {
        const apt = await getActiveApartment(userId);
        if (!apt) return res.json({ status: "none" });

        const [[row]] = await pool.query<RowDataPacket[]>(
            `SELECT id, doc_type, status, comment, submitted_at, reviewed_at
             FROM verification_requests
             WHERE apartment_id = ?
             ORDER BY submitted_at DESC
             LIMIT 1`,
            [apt.apartmentId],
        );

        if (!row) return res.json({ status: "none" });

        const [photoRows] = await pool.query<RowDataPacket[]>(
            `SELECT url FROM verification_photos
             WHERE verification_request_id = ?
             ORDER BY position`,
            [row.id],
        );

        return res.json({
            status: row.status as string,
            docType: row.doc_type as string,
            comment: (row.comment as string | null) ?? undefined,
            submittedAt: (row.submitted_at as Date).toISOString(),
            reviewedAt: row.reviewed_at ? (row.reviewed_at as Date).toISOString() : undefined,
            photoUrls: photoRows.map((p) => p.url as string),
        });
    } catch (err) {
        console.error("[verification GET]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/verification/submit — подать заявку
router.post("/submit", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId!;
    const { docType, photoUrls } = req.body as { docType?: string; photoUrls?: string[] };

    if (!docType || !VALID_DOC_TYPES.includes(docType)) {
        return res.status(400).json({ error: "Некорректный тип документа" });
    }
    if (!photoUrls?.length) {
        return res.status(400).json({ error: "Фото документа обязательно" });
    }

    try {
        const apt = await getActiveApartment(userId);
        if (!apt) return res.status(400).json({ error: "Профиль не привязан к дому" });

        // Проверяем — нет ли активной заявки
        const [[existing]] = await pool.query<RowDataPacket[]>(
            `SELECT id, status FROM verification_requests
             WHERE apartment_id = ? AND status = 'pending'
             LIMIT 1`,
            [apt.apartmentId],
        );
        if (existing) {
            return res.status(409).json({ error: "Заявка уже на рассмотрении" });
        }

        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO verification_requests (apartment_id, doc_type, status, submitted_at)
             VALUES (?, ?, 'pending', NOW())`,
            [apt.apartmentId, docType],
        );

        for (let i = 0; i < photoUrls.length; i++) {
            await pool.execute(
                `INSERT IGNORE INTO verification_photos (verification_request_id, url, position)
                 VALUES (?, ?, ?)`,
                [result.insertId, photoUrls[i], i],
            );
        }

        return res.status(201).json({
            status: "pending",
            docType,
            submittedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("[verification POST]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
