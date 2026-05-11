import type { Vote, VoteSponsor } from "../types";

/** Подпись источника для ленты и карточек */
export function voteSourceLine(vote: Vote): string {
    const src = vote.sponsor === "uk" ? "От УК" : "От жильцов";
    return vote.trial ? `${src} · пробное голосование` : src;
}

export function inferVoteSponsorFromLabel(createdByLabel: string): VoteSponsor {
    const l = createdByLabel.toLowerCase();
    if (l.includes("ук") || l.includes("управляющ")) return "uk";
    return "residents";
}
