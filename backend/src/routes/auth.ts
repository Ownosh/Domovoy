import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const SALT_ROUNDS = 12;
const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 30;

function makeTokens(userId: number) {
    const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
    const refreshToken = crypto.randomBytes(40).toString("hex");
    return { accessToken, refreshToken };
}

async function storeRefreshToken(userId: number, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);
    await pool.execute(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        [userId, token, expiresAt],
    );
}

// POST /api/auth/register
const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
    phone: z.string().min(1),
    building: z.string().min(1),
    buildingKey: z.string().optional(),
    apartment: z.string().min(1),
    entrance: z.number().int().positive(),
    dataConsentAt: z.string(),
});

router.post("/register", async (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Некорректные данные", details: parsed.error.flatten().fieldErrors });
        return;
    }

    const { email, password, name, phone, building, buildingKey: explicitKey, apartment, entrance, dataConsentAt } = parsed.data;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [existRows] = await conn.execute(
            "SELECT id FROM users WHERE email = ?",
            [email.toLowerCase()],
        ) as [RowDataPacket[], unknown];

        if (existRows.length > 0) {
            await conn.rollback();
            res.status(409).json({ error: "Email уже зарегистрирован" });
            return;
        }

        // Проверка уникальности телефона
        if (phone?.trim()) {
            const [phoneRows] = await conn.execute(
                "SELECT user_id FROM user_profiles WHERE phone = ?",
                [phone.trim()],
            ) as [RowDataPacket[], unknown];
            if (phoneRows.length > 0) {
                await conn.rollback();
                res.status(409).json({ error: "Этот номер телефона уже используется другим пользователем" });
                return;
            }
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const [userResult] = await conn.execute(
            "INSERT INTO users (email, password_hash, data_consent_at) VALUES (?, ?, ?)",
            [email.toLowerCase(), passwordHash, new Date(dataConsentAt)],
        ) as [ResultSetHeader, unknown];

        const userId = userResult.insertId;

        const buildingLabel = building.trim();
        const normalizedAddress = buildingLabel.toLowerCase().replace(/\s+/g, " ");

        let buildingKey: string;
        if (explicitKey?.trim()) {
            buildingKey = explicitKey.trim();
        } else {
            const [[existing]] = await conn.query<RowDataPacket[]>(
                `SELECT building_key FROM buildings
                 WHERE LOWER(short_name) = ? OR LOWER(address) = ?
                 LIMIT 1`,
                [normalizedAddress, normalizedAddress],
            );
            if (!existing?.building_key) {
                await conn.rollback();
                res.status(400).json({ error: "Дом не найден — выберите адрес из подсказок" });
                return;
            }
            buildingKey = existing.building_key as string;
        }

        await conn.execute(
            `INSERT INTO buildings (building_key, address, short_name)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE building_key = building_key`,
            [buildingKey, buildingLabel, buildingLabel],
        );
        await conn.execute(
            "INSERT INTO user_profiles (user_id, full_name, phone) VALUES (?, ?, ?)",
            [userId, name, phone],
        );
        const [aptResult] = await conn.execute(
            "INSERT INTO user_apartments (user_id, building_key, apartment, entrance) VALUES (?, ?, ?, ?)",
            [userId, buildingKey, apartment, entrance],
        ) as [ResultSetHeader, unknown];
        await conn.execute(
            "UPDATE user_profiles SET active_apartment_id = ? WHERE user_id = ?",
            [aptResult.insertId, userId],
        );

        await conn.commit();

        const { accessToken, refreshToken } = makeTokens(userId);
        await storeRefreshToken(userId, refreshToken);

        res.status(201).json({
            accessToken,
            refreshToken,
            user: { id: userId, email: email.toLowerCase() },
            profile: { name, phone, building: buildingKey, buildingName: buildingLabel, apartment, entrance: entrance ?? undefined },
        });
    } catch (err) {
        await conn.rollback();
        console.error("[register]", err);
        res.status(500).json({ error: "Ошибка сервера" });
    } finally {
        conn.release();
    }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
        res.status(400).json({ error: "Email и пароль обязательны" });
        return;
    }

    try {
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT u.id, u.email, u.password_hash,
                    p.full_name, p.phone, p.profile_photo,
                    ua.building_key, ua.apartment, ua.entrance, ua.apartment_area_sqm,
                    COALESCE(b.short_name, ua.building_key) AS building_name
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
             LEFT JOIN user_apartments ua ON ua.id = p.active_apartment_id
             LEFT JOIN buildings b ON b.building_key = ua.building_key
             WHERE u.email = ? AND u.is_active = 1`,
            [email.toLowerCase()],
        );

        if (rows.length === 0) {
            res.status(401).json({ error: "Неверный email или пароль" });
            return;
        }

        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash as string);
        if (!valid) {
            res.status(401).json({ error: "Неверный email или пароль" });
            return;
        }

        const { accessToken, refreshToken } = makeTokens(user.id as number);
        await storeRefreshToken(user.id as number, refreshToken);

        res.json({
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email },
            profile: {
                name: (user.full_name as string) ?? "",
                phone: (user.phone as string) ?? "",
                building: (user.building_key as string) ?? "",
                buildingName: (user.building_name as string) || undefined,
                apartment: (user.apartment as string) ?? "",
                entrance: Number(user.entrance ?? 0) || undefined,
                apartmentAreaSqm: (user.apartment_area_sqm as number) ?? undefined,
                profilePhoto: (user.profile_photo as string | null) ?? undefined,
            },
        });
    } catch (err) {
        console.error("[login]", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
        res.status(400).json({ error: "Refresh token обязателен" });
        return;
    }

    try {
        const [rows] = await pool.execute<RowDataPacket[]>(
            "SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?",
            [refreshToken],
        );

        if (rows.length === 0) {
            res.status(401).json({ error: "Недействительный refresh token" });
            return;
        }

        const { user_id, expires_at } = rows[0];
        if (new Date() > new Date(expires_at as string)) {
            await pool.execute("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);
            res.status(401).json({ error: "Refresh token истёк" });
            return;
        }

        await pool.execute("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);
        const { accessToken, refreshToken: newRefresh } = makeTokens(user_id as number);
        await storeRefreshToken(user_id as number, newRefresh);

        res.json({ accessToken, refreshToken: newRefresh });
    } catch (err) {
        console.error("[refresh]", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { refreshToken } = req.body as { refreshToken?: string };
    try {
        if (refreshToken) {
            await pool.execute("DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?", [refreshToken, userId]);
        }
        res.json({ ok: true });
    } catch (err) {
        console.error("[logout]", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// PATCH /api/auth/profile
router.patch("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { name, phone, building, buildingKey: explicitKey, apartment, entrance, apartmentAreaSqm, profilePhoto } = req.body as {
        name?: string;
        phone?: string;
        building?: string;
        buildingKey?: string;
        apartment?: string;
        entrance?: number;
        apartmentAreaSqm?: number | null;
        profilePhoto?: string | null;
    };

    try {
        // Проверка уникальности телефона при редактировании профиля
        if (phone?.trim()) {
            const [phoneRows] = await pool.execute(
                "SELECT user_id FROM user_profiles WHERE phone = ? AND user_id != ?",
                [phone.trim(), userId],
            ) as [RowDataPacket[], unknown];
            if (phoneRows.length > 0) {
                res.status(409).json({ error: "Этот номер телефона уже используется другим пользователем" });
                return;
            }
        }

        let buildingKey: string | undefined;
        if (building != null) {
            const buildingLabel = building.trim();
            const normalizedAddress = buildingLabel.toLowerCase().replace(/\s+/g, " ");
            if (explicitKey?.trim()) {
                buildingKey = explicitKey.trim();
            } else {
                const [[existing]] = await pool.query<RowDataPacket[]>(
                    `SELECT building_key FROM buildings
                     WHERE LOWER(short_name) = ? OR LOWER(address) = ?
                     LIMIT 1`,
                    [normalizedAddress, normalizedAddress],
                );
                if (!existing?.building_key) {
                    res.status(400).json({ error: "Дом не найден — выберите адрес из подсказок" });
                    return;
                }
                buildingKey = existing.building_key as string;
            }
            await pool.execute(
                `INSERT INTO buildings (building_key, address, short_name)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE building_key = building_key`,
                [buildingKey, buildingLabel, buildingLabel],
            );
        }

        await pool.execute(
            `UPDATE user_profiles
             SET full_name     = COALESCE(?, full_name),
                 phone         = COALESCE(?, phone),
                 profile_photo = COALESCE(?, profile_photo)
             WHERE user_id = ?`,
            [
                name?.trim() ?? null,
                phone?.trim() ?? null,
                profilePhoto !== undefined ? profilePhoto : null,
                userId,
            ],
        );

        if (buildingKey != null || apartment != null || entrance != null || apartmentAreaSqm !== undefined) {
            await pool.execute(
                `UPDATE user_apartments ua
                 JOIN user_profiles p ON p.active_apartment_id = ua.id
                 SET ua.building_key       = COALESCE(?, ua.building_key),
                     ua.apartment          = COALESCE(?, ua.apartment),
                     ua.entrance           = COALESCE(?, ua.entrance),
                     ua.apartment_area_sqm = COALESCE(?, ua.apartment_area_sqm)
                 WHERE p.user_id = ?`,
                [
                    buildingKey ?? null,
                    apartment?.trim() ?? null,
                    entrance != null ? Number(entrance) : null,
                    apartmentAreaSqm ?? null,
                    userId,
                ],
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error("[profile patch]", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// PATCH /api/auth/password
router.patch("/password", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Укажите текущий и новый пароль" });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ error: "Новый пароль не менее 6 символов" });
        return;
    }

    try {
        const [rows] = await pool.execute<RowDataPacket[]>(
            "SELECT password_hash FROM users WHERE id = ?",
            [userId],
        );
        if (rows.length === 0) {
            res.status(404).json({ error: "Пользователь не найден" });
            return;
        }

        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash as string);
        if (!valid) {
            res.status(401).json({ error: "Текущий пароль неверен" });
            return;
        }

        const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, userId]);
        await pool.execute("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);

        res.json({ ok: true });
    } catch (err) {
        console.error("[password]", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
