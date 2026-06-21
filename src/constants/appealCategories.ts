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

export const appealCategoryOptions = APPEAL_CATEGORY_KEYS.map((key) => ({
    key,
    label: APPEAL_CATEGORY_LABELS[key],
}));
