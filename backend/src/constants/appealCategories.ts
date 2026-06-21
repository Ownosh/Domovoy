export const APPEAL_CATEGORY_KEYS = [
    "emergency",
    "plumbing",
    "electrical",
    "heating",
    "ventilation",
    "cleaning",
    "order_violation",
    "owners_meeting",
    "other",
] as const;

export type AppealCategoryKey = (typeof APPEAL_CATEGORY_KEYS)[number];

export const OWNERS_MEETING_CATEGORY: AppealCategoryKey = "owners_meeting";

export const APPEAL_CATEGORY_LABELS: Record<AppealCategoryKey, string> = {
    emergency: "Аварийная ситуация",
    plumbing: "Сантехника",
    electrical: "Электрика",
    heating: "Отопление",
    ventilation: "Вентиляция",
    cleaning: "Уборка и благоустройство",
    order_violation: "Нарушение порядка",
    owners_meeting: "Инициатива собрания собственников",
    other: "Другое",
};

/** Миграция русских значений ENUM → стабильные ключи. */
export const LEGACY_APPEAL_CATEGORY_MAP: Record<string, AppealCategoryKey> = {
    "Аварийная ситуация": "emergency",
    "Сантехника": "plumbing",
    "Электрика": "electrical",
    "Отопление": "heating",
    "Вентиляция": "ventilation",
    "Уборка и благоустройство": "cleaning",
    "Нарушение порядка": "order_violation",
    "Инициатива собрания собственников": "owners_meeting",
    "Другое": "other",
    "Оборудование": "other",
};

export function isValidAppealCategory(value: string): value is AppealCategoryKey {
    return (APPEAL_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function appealCategoryLabel(key: string): string {
    return APPEAL_CATEGORY_LABELS[key as AppealCategoryKey] ?? key;
}
