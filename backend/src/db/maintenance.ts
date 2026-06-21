import { pool } from "./client";

/** Периодическое обслуживание: архивация сущностей и очистка токенов. */
export async function runMaintenance(): Promise<void> {
    await pool.query(
        `UPDATE neighbor_ads SET status = 'archived' WHERE status = 'published' AND expires_at <= NOW()`,
    );
    await pool.query(`
        UPDATE appeals SET manually_archived = 1
        WHERE manually_archived = 0
          AND status IN ('resolved', 'closed', 'rejected')
          AND COALESCE(resolved_at, created_at) <= NOW() - INTERVAL 24 HOUR
    `);
    await pool.query(`
        UPDATE votes SET closed = 1
        WHERE closed = 0
          AND moderation_status NOT IN ('cancelled')
          AND ends_at <= NOW()
    `);
    await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
}

/** MariaDB EVENT (раз в час), если event_scheduler доступен. */
export async function installMaintenanceEvents(): Promise<void> {
    try {
        await pool.query(`SET GLOBAL event_scheduler = ON`);
    } catch (err) {
        console.warn("[maintenance] event_scheduler not enabled (need SUPER?):", err);
    }

    await pool.query(`DROP EVENT IF EXISTS evt_domovoy_maintenance`);
    await pool.query(`
        CREATE EVENT evt_domovoy_maintenance
        ON SCHEDULE EVERY 1 HOUR
        STARTS CURRENT_TIMESTAMP
        ON COMPLETION PRESERVE
        ENABLE
        COMMENT 'Archive ads/appeals, close expired votes, purge refresh tokens'
        DO
        BEGIN
            UPDATE neighbor_ads SET status = 'archived'
              WHERE status = 'published' AND expires_at <= NOW();
            UPDATE appeals SET manually_archived = 1
              WHERE manually_archived = 0
                AND status IN ('resolved', 'closed', 'rejected')
                AND COALESCE(resolved_at, created_at) <= NOW() - INTERVAL 24 HOUR;
            UPDATE votes SET closed = 1
              WHERE closed = 0
                AND moderation_status NOT IN ('cancelled')
                AND ends_at <= NOW();
            DELETE FROM refresh_tokens WHERE expires_at < NOW();
        END
    `);
    console.log("[maintenance] evt_domovoy_maintenance installed");
}

let maintenanceTimer: ReturnType<typeof setInterval> | null = null;

/** Fallback, если EVENT scheduler выключен или нет прав SUPER. */
export function startMaintenanceScheduler(intervalMs = 60 * 60 * 1000): void {
    if (maintenanceTimer) return;
    maintenanceTimer = setInterval(() => {
        runMaintenance().catch((err) => console.error("[maintenance] scheduled run failed:", err));
    }, intervalMs);
    console.log(`[maintenance] in-process scheduler every ${intervalMs / 1000}s`);
}
