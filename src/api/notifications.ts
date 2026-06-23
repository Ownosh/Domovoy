import { apiRequest } from "./client";
import type { AppNotification, NotificationPrefs } from "../types";

export async function apiFetchNotificationPrefs(): Promise<NotificationPrefs> {
    return apiRequest<NotificationPrefs>("/notifications/prefs");
}

export async function apiUpdateNotificationPrefs(
    prefs: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
    return apiRequest<NotificationPrefs>("/notifications/prefs", {
        method: "PATCH",
        body: JSON.stringify(prefs),
    });
}

export async function apiFetchNotifications(): Promise<AppNotification[]> {
    return apiRequest<AppNotification[]>("/notifications");
}

export async function apiMarkNotificationRead(id: string): Promise<void> {
    await apiRequest(`/notifications/${id}/read`, { method: "POST" });
}

export async function apiMarkAllNotificationsRead(): Promise<void> {
    await apiRequest("/notifications/read-all", { method: "POST" });
}
