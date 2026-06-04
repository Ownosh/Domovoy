import { apiRequest } from "./client";
import type { VerificationState } from "../types";

export async function apiFetchVerificationStatus(): Promise<VerificationState> {
    return apiRequest<VerificationState>("/verification/status");
}

export async function apiSubmitVerification(data: {
    docType: "lease" | "ownership";
    photoUrl: string;
}): Promise<VerificationState> {
    return apiRequest<VerificationState>("/verification/submit", {
        method: "POST",
        body: JSON.stringify(data),
    });
}
