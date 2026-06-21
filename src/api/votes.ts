import { apiRequest } from "./client";
import type { Vote, VoteCast } from "../types";

export type VotesResponse = { votes: Vote[]; casts: VoteCast[] };

export async function apiFetchVotes(): Promise<VotesResponse> {
    return apiRequest<VotesResponse>("/votes");
}

export async function apiCreateVote(data: {
    topic: string;
    description: string;
    visibility: string;
    optionLabels: string[];
    durationDays: number;
    createdByLabel: string;
}): Promise<Vote> {
    return apiRequest<Vote>("/votes", { method: "POST", body: JSON.stringify(data) });
}

export async function apiEditVote(id: string, data: {
    topic: string; description: string; visibility: string; optionLabels: string[];
}): Promise<Vote> {
    return apiRequest<Vote>(`/votes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteVote(id: string): Promise<void> {
    await apiRequest(`/votes/${id}`, { method: "DELETE" });
}

export async function apiCastVote(data: {
    voteId: string;
    optionId: string;
}): Promise<void> {
    await apiRequest(`/votes/${data.voteId}/cast`, {
        method: "POST",
        body: JSON.stringify({ optionId: data.optionId }),
    });
}
