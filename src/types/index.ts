export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export type AppealStatus = "new" | "accepted" | "in_progress" | "resolved" | "rejected";

export type User = {
    id: string;
    email: string;
};

export type Profile = {
    name: string;
    phone: string;
    apartment: string;
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
};

export type NotificationType = "outage" | "meeting" | "announcement" | "general";

export type AppNotification = {
    id: string;
    title: string;
    body: string;
    type: NotificationType;
    date: string;
    read: boolean;
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

export type PoiCategory = "education" | "health" | "shopping" | "leisure";

export type DistrictPoi = {
    id: string;
    name: string;
    category: PoiCategory;
    address: string;
    lat: number;
    lng: number;
};

export type UkContacts = {
    companyName: string;
    email: string;
    phone: string;
    site: string;
    hours: string;
};
