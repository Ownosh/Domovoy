import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 2,   // минимум для разработки
    maxIdle: 1,           // держим не более 1 idle-соединения
    idleTimeout: 10000,   // закрываем idle через 10 секунд
    charset: "utf8mb4",
    ssl: { rejectUnauthorized: false },
});

// Закрываем все соединения при остановке — tsx watch должен их освободить
const shutdown = () => { pool.end().catch(() => {}); };
process.once("SIGINT",  shutdown);
process.once("SIGTERM", shutdown);
