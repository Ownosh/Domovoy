import type { ApartmentVerificationStatus } from "../types";

/** user_apartments.verification_status: после одобрения — lease/ownership, не approved */
export function normalizeApartmentVerificationStatus(
    status: string,
): ApartmentVerificationStatus | "none" {
    if (status === "lease" || status === "ownership") return "approved";
    if (
        status === "none" ||
        status === "pending" ||
        status === "approved" ||
        status === "rejected"
    ) {
        return status;
    }
    return "none";
}
