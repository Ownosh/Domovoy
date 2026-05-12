export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export type AppealStatus =
    | "new"
    | "accepted"
    | "in_progress"
    | "mass_appeal"
    | "resolved"
    | "rejected";

export type AppealKind = "personal" | "collective";

export type AppealParticipant = {
    userId: string;
    apartment: string;
    /** Совпадает с подъездом обращения при коллективном пороге */
    entrance?: string;
    displayName: string;
    anonymous: boolean;
    comment?: string;
    photoUri?: string;
    joinedAt: string;
};

export type User = {
    id: string;
    email: string;
};

export type Profile = {
    name: string;
    phone: string;
    /** ЖК, улица, дом, корпус — как ввёл житель */
    building: string;
    /** Номер квартиры */
    apartment: string;
    /** Площадь квартиры, м² — для веса голоса на ОСС */
    apartmentAreaSqm?: number;
};

export type VerificationState = {
    status: VerificationStatus;
    docType?: "lease" | "ownership";
    submittedAt?: string;
    comment?: string;
};

export type Appeal = {
    id: string;
    title: string;
    body: string;
    category: string;
    status: AppealStatus;
    createdAt: string;
    kind: AppealKind;
    authorUserId: string;
    /** Нормализованный ключ дома для ленты и коллективных обращений */
    buildingKey: string;
    /** Подъезд — для порога «уникальных квартир в подъезде» */
    entrance?: string;
    /** Квартира автора (для подсчёта порога) */
    authorApartment: string;
    participants: AppealParticipant[];
    escalatedToUk?: boolean;
};

export type NotificationType =
    | "outage"
    | "meeting"
    | "announcement"
    | "general";

export type AppNotification = {
    id: string;
    title: string;
    body: string;
    type: NotificationType;
    date: string;
    read: boolean;
    /** Если задано — уведомление только этому пользователю */
    recipientUserId?: string;
};

export type NotificationPrefs = {
    outages: boolean;
    meetings: boolean;
    announcements: boolean;
    general: boolean;
};

export type NewsItem = {
    id: string;
    title: string;
    excerpt: string;
    date: string;
    imageUrl: string;
};

export type HouseSpec = { label: string; value: string };

export type HousePassport = {
    address: string;
    yearBuilt: number;
    entrances: number;
    apartments: number;
    specs: HouseSpec[];
    photoUrls: string[];
};

/**
 * Слои карты: «город» — объекты по всему Кирову; «дом» — только у вашего дома
 * (контейнеры, парковка и остановки рядом с подъездом).
 */
export const DISTRICT_MAP_LAYER_IDS = [
    "schools_daycare",
    "clinic_pharmacy",
    "grocery",
    "parks",
    "bus_stops_city",
    "parking_city",
    "waste_yard",
    "bus_stops_house",
    "parking_house",
] as const;

export type DistrictMapLayerId = (typeof DISTRICT_MAP_LAYER_IDS)[number];

export type DistrictSearchHit = {
    id: string;
    title: string;
    address: string;
    lat: number;
    lng: number;
};

export type DistrictPoiScope = "city" | "house";

export type DistrictPoi = {
    id: string;
    name: string;
    layerId: DistrictMapLayerId;
    address: string;
    lat: number;
    lng: number;
    scope: DistrictPoiScope;
    /** Условный рейтинг 1–5 для подбора «лучшей» точки в категории */
    rating?: number;
    /** Часы работы, уроки, приём — по типу объекта */
    schedule?: string;
    /** Фото для карточки на карте */
    photoUrl?: string;
};

export type UkContacts = {
    companyName: string;
    email: string;
    phone: string;
    site: string;
    hours: string;
};

export type NeighborAdCategory =
    | "sell"
    | "buy"
    | "service"
    | "invite"
    | "lost"
    | "found"
    | "other";

export type NeighborAd = {
    id: string;
    authorUserId: string;
    buildingKey: string;
    title: string;
    body: string;
    category: NeighborAdCategory;
    imageUrl?: string;
    showPhone: boolean;
    /** Если showPhone — номер для звонка (как в профиле на момент публикации) */
    authorPhone?: string;
    createdAt: string;
    expiresAt: string;
    archived: boolean;
    pendingModeration?: boolean;
};

export type VoteVisibility = "open" | "secret";

export type VoteOption = { id: string; label: string };

/** Кто инициировал опрос в ленте дома */
export type VoteSponsor = "uk" | "residents";

export type Vote = {
    id: string;
    buildingKey: string;
    createdByLabel: string;
    topic: string;
    description: string;
    options: VoteOption[];
    endsAt: string;
    visibility: VoteVisibility;
    createdAt: string;
    closed?: boolean;
    sponsor: VoteSponsor;
    /** Учебный пример в интерфейсе */
    trial?: boolean;
};

/** Создание голосования жильцом (УК создаёт на стороне сервера) */
export type ResidentVoteCreateInput = {
    topic: string;
    description: string;
    visibility: VoteVisibility;
    /** 2–4 непустых варианта ответа */
    optionLabels: string[];
    durationDays: 3 | 7 | 14;
};

export type VoteCast = {
    voteId: string;
    userId: string;
    optionId: string;
    votedAt: string;
    areaSqm: number;
};

/** Идентификаторы тегов «что не понравилось» при оценке ≤3 звёзд */
export type EnvironmentRatingFeedbackTagId =
    | "yard"
    | "entrance"
    | "uk_comm"
    | "uk_work"
    | "contractors"
    | "safety"
    | "other";

/** Оценка двора, подъезда и УК — одна на календарный месяц, без правок после отправки */
export type EnvironmentRatingSnapshot = {
    courtyardStars: 1 | 2 | 3 | 4 | 5;
    entranceStars: 1 | 2 | 3 | 4 | 5;
    ukStars: 1 | 2 | 3 | 4 | 5;
    /** Календарный месяц оценки YYYY-MM */
    monthKey: string;
    /** Если хотя бы одна оценка ≤3 — выбранные причины */
    feedbackTagIds?: EnvironmentRatingFeedbackTagId[];
    /** Свой текст, в т.ч. при выборе «Другое» */
    feedbackOther?: string;
    submittedAt: string;
};

export type EnvironmentRatingSubmitInput = {
    courtyardStars: 1 | 2 | 3 | 4 | 5;
    entranceStars: 1 | 2 | 3 | 4 | 5;
    ukStars: 1 | 2 | 3 | 4 | 5;
    feedbackTagIds?: EnvironmentRatingFeedbackTagId[];
    feedbackOther?: string;
};

/** События на календаре дома (уборка, работы и т.д.) */
export type HouseCalendarActivityKind =
    | "yard"
    | "pipes"
    | "meeting"
    | "heating"
    | "garbage"
    | "other";

export type HouseCalendarActivity = {
    id: string;
    /** Локальная дата YYYY-MM-DD */
    date: string;
    title: string;
    kind: HouseCalendarActivityKind;
};

export type TrashPickupRow = {
    id: string;
    title: string;
    schedule: string;
    note?: string;
};

export type ContractorProfile = {
    id: string;
    name: string;
    workKinds: string[];
    /** Средняя по закрытым оценённым заявкам */
    avgStars: number;
    closedJobsRated: number;
};

/** Публичная отчётность УК (агрегат с сервера, снимок раз в сутки) */
export type UkTransparencyStats = {
    snapshotAtIso: string;
    avgAppealStars3m: number;
    closedAppeals90d: number;
    closedOnTimePercent: number;
};

export type EmergencyScenarioId = "fire" | "gas" | "flood" | "power";

export type EmergencyContactLine = {
    id: string;
    title: string;
    subtitle?: string;
    /** Только цифры и + для tel: */
    phone: string;
};
