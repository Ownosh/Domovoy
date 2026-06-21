import type { Appeal, Vote, NeighborAd, VoteStatus, NeighborAdStatus, VoteCast } from "../types";

const HOUR_MS = 60 * 60 * 1000;
const ARCHIVE_HOURS = 24;
const archivedStatuses = new Set<Appeal["status"]>(["resolved", "closed", "rejected"]);

export function voteEffectiveStatus(vote: Vote): VoteStatus {
    if (vote.status) return vote.status;
    if (vote.closed || new Date(vote.endsAt).getTime() <= Date.now()) return "completed";
    return "active";
}

export function adEffectiveStatus(ad: NeighborAd): NeighborAdStatus {
    if (ad.status) return ad.status;
    if (ad.archived) return "archived";
    if (ad.pendingModeration) return "under_review_appeal";
    return "published";
}

export function isArchivedVote(vote: Vote): boolean {
    const status = voteEffectiveStatus(vote);
    return status === "completed" || status === "cancelled";
}

export function isArchivedNeighborAd(ad: NeighborAd): boolean {
    return ad.archived || adEffectiveStatus(ad) === "archived";
}

/** Порог квартир в подъезде для массовой жалобы. */
export const MASS_APPEAL_THRESHOLD = 5;

/** Категория обращения — стабильный ключ (emergency, plumbing, …). */
export const OWNERS_MEETING_CATEGORY = "owners_meeting";

export function isArchivedAppeal(appeal: Appeal): boolean {
    if (appeal.manuallyArchived) return true;
    if (!archivedStatuses.has(appeal.status)) return false;
    // отсчёт 24 ч от времени решения, а не создания
    const baseDate = appeal.resolvedAt ?? appeal.createdAt;
    const baseMs = new Date(baseDate).getTime();
    if (Number.isNaN(baseMs)) return false;
    return Date.now() - baseMs >= ARCHIVE_HOURS * HOUR_MS;
}

/** Пользователь — автор или участник коллективного обращения. */
export function userInCollectiveAppeal(appeal: Appeal, userId: string): boolean {
    if (appeal.kind !== "collective") return false;
    const uid = String(userId);
    if (String(appeal.authorUserId) === uid) return true;
    return appeal.participants.some((p) => String(p.userId) === uid);
}

/** Пользователь проголосовал в этом голосовании (любая его квартира). */
export function userParticipatedInVote(voteId: string, voteCasts: VoteCast[], userId: string): boolean {
    const uid = String(userId);
    return voteCasts.some((c) => c.voteId === voteId && String(c.userId) === uid);
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
        appeal.status !== "closed" &&
        appeal.status !== "rejected" &&
        collectiveUniqueApartmentCount(appeal) >= MASS_APPEAL_THRESHOLD
    );
}
