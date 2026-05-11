import type { Appeal } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_DELAY_DAYS = 3;
const archivedStatuses = new Set<Appeal["status"]>(["resolved", "rejected"]);

/** Порог уникальных квартир (в рамках подъезда, если указан) для «Массового обращения» */
export const MASS_APPEAL_THRESHOLD = 5;

function isOlderThanArchiveDelay(createdAt: string): boolean {
    const createdAtMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdAtMs)) return false;
    return Date.now() - createdAtMs >= ARCHIVE_DELAY_DAYS * DAY_MS;
}

export function isArchivedAppeal(appeal: Appeal): boolean {
    return (
        archivedStatuses.has(appeal.status) &&
        isOlderThanArchiveDelay(appeal.createdAt)
    );
}

function normApt(s: string): string {
    return s.trim().toLowerCase();
}

export function collectiveUniqueApartmentCount(appeal: Appeal): number {
    if (appeal.kind !== "collective") return 1;
    const targetEnt = appeal.entrance?.trim();
    const set = new Set<string>();
    set.add(normApt(appeal.authorApartment));
    for (const p of appeal.participants) {
        if (targetEnt) {
            const pe = p.entrance?.trim();
            if (pe && pe !== targetEnt) continue;
        }
        set.add(normApt(p.apartment));
    }
    return set.size;
}

/** Порог квартир в подъезде: статус «Принято» и передача в УК (один раз). */
export function shouldEscalateToMassAppeal(appeal: Appeal): boolean {
    return (
        appeal.kind === "collective" &&
        !appeal.escalatedToUk &&
        appeal.status !== "resolved" &&
        appeal.status !== "rejected" &&
        collectiveUniqueApartmentCount(appeal) >= MASS_APPEAL_THRESHOLD
    );
}
