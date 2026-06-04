import { apiRequest } from "./client";
import type { AppNotification } from "../types";

export async function apiFetchNotifications(): Promise<AppNotification[]> {
    return apiRequest<AppNotification[]>("/notifications");
}

export async function apiMarkNotificationRead(id: string): Promise<void> {
    await apiRequest(`/notifications/${id}/read`, { method: "POST" });
}

export async function apiMarkAllNotificationsRead(): Promise<void> {
    await apiRequest("/notifications/read-all", { method: "POST" });
}
