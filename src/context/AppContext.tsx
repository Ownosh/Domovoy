import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiLogin, apiLogout, apiRegister, apiChangePassword } from "../api/auth";
import { apiFetchNews } from "../api/news";
import { apiFetchVotes, apiCreateVote, apiCastVote, apiEditVote, apiDeleteVote } from "../api/votes";
import { apiFetchNeighborAds, apiCreateNeighborAd, apiDeleteNeighborAd, apiExtendNeighborAd, apiReportNeighborAd, apiEditNeighborAd } from "../api/neighborAds";
import { apiFetchAppeals, apiCreateAppeal, apiJoinAppeal, apiDeleteAppeal, apiEditAppeal, apiArchiveAppeal } from "../api/appeals";
import { clearTokens, ApiError } from "../api/client";
import { apiSubmitRating, apiFetchMyRating, apiFetchRatingStats } from "../api/ratings";
import { apiFetchBuildingInfo, apiFetchBuildingPhotos, apiFetchBuildingSpecs, apiFetchBuildingSchedule, apiFetchBuildingCalendar, apiFetchBuildingContacts, type BuildingInfo, type BuildingSpec, type HouseScheduleItem } from "../api/buildings";
import { apiFetchDistrictPois } from "../api/district";
import { apiFetchNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead } from "../api/notifications";
import { apiFetchVerificationStatus, apiSubmitVerification } from "../api/verification";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
} from "react";
import {
    seedNeighborAds,
    seedNews,
    seedVoteCasts,
    seedVotes,
} from "../data/mockData";
import type {
    Appeal,
    AppealKind,
    AppealParticipant,
    AppNotification,
    DistrictPoi,
    EnvironmentRatingFeedbackTagId,
    EnvironmentRatingSnapshot,
    EnvironmentRatingSubmitInput,
    UkTransparencyStats,
    UkContacts,
    HouseCalendarActivity,
    NeighborAd,
    NeighborAdCategory,
    NewsItem,
    NotificationPrefs,
    Profile,
    ResidentVoteCreateInput,
    User,
    VerificationState,
    Vote,
    VoteCast,
    VoteOption,
    VoteSponsor,
} from "../types";
import { buildBuildingKey } from "../utils/buildingKey";
import { inferVoteSponsorFromLabel } from "../utils/voteSponsor";
import {
    collectiveUniqueApartmentCount,
    shouldEscalateToMassAppeal,
} from "../utils/appeals";
import { registerPushToken } from "../utils/pushNotifications";

const STORAGE_KEY = "@domovoy/app_state_v2";
const STORAGE_KEY_LEGACY = "@domovoy/app_state_v1";

const NEIGHBOR_AD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isVerifiedResident(v: VerificationState): boolean {
    return v.status === "approved";
}

export function isVerifiedOwner(v: VerificationState): boolean {
    return v.status === "approved" && v.docType === "ownership";
}

type Account = {
    user: User;
    profile: Profile;
    password: string;
    /** ISO — момент принятия согласия на обработку ПДн при регистрации */
    dataConsentAt?: string;
};

type AppState = {
    account: Account | null;
    sessionActive: boolean;
    verification: VerificationState;
    appeals: Appeal[];
    notifications: AppNotification[];
    news: NewsItem[];
    notificationPrefs: NotificationPrefs;
    neighborAds: NeighborAd[];
    votes: Vote[];
    voteCasts: VoteCast[];
    environmentRating: EnvironmentRatingSnapshot | null;
    ukStats: Partial<UkTransparencyStats>;
    districtPois: DistrictPoi[];
    districtAnchor: { lat: number; lng: number } | null;
    houseInfo: BuildingInfo | null;
    housePhotos: string[];
    houseSpecs: BuildingSpec[];
    houseSchedule: HouseScheduleItem[];
    houseCalendar: HouseCalendarActivity[];
    ukContacts: UkContacts | null;
};

const defaultPrefs: NotificationPrefs = {
    outages: true,
    meetings: true,
    announcements: true,
    general: true,
};

const initialState: AppState = {
    account: null,
    sessionActive: false,
    verification: { status: "none" },
    appeals: [],
    notifications: [],
    news: [],
    notificationPrefs: defaultPrefs,
    neighborAds: [],
    votes: [],
    voteCasts: [],
    environmentRating: null,
    ukStats: {},
    districtPois: [],
    districtAnchor: null,
    houseInfo: null,
    housePhotos: [],
    houseSpecs: [],
    houseSchedule: [],
    houseCalendar: [],
    ukContacts: null,
};

type Action =
    | { type: "REPLACE"; payload: AppState }
    | { type: "SESSION_START" }
    | { type: "SESSION_END" }
    | { type: "LOGIN"; payload: Account }
    | { type: "REGISTER"; payload: Account }
    | { type: "UPDATE_PROFILE"; payload: Partial<Profile> }
    | { type: "CHANGE_PASSWORD"; payload: string }
    | {
          type: "SUBMIT_VERIFICATION";
          payload: { docType: "lease" | "ownership" };
      }
    | {
          type: "ADD_APPEAL";
          payload: {
              title: string;
              body: string;
              category: string;
              kind: AppealKind;
              entrance?: string;
              authorUserId: string;
              buildingKey: string;
              authorApartment: string;
          };
      }
    | { type: "DELETE_APPEAL"; payload: string }
    | {
          type: "JOIN_APPEAL";
          payload: {
              appealId: string;
              participant: AppealParticipant;
          };
      }
    | { type: "MARK_NOTIF_READ"; payload: string }
    | { type: "TOGGLE_PREF"; payload: keyof NotificationPrefs }
    | { type: "DELETE_ACCOUNT" }
    | { type: "SET_VERIFICATION_STATUS"; payload: VerificationState }
    | { type: "ARCHIVE_EXPIRED_NEIGHBOR_ADS" }
    | { type: "ADD_NEIGHBOR_AD"; payload: NeighborAd }
    | { type: "EXTEND_NEIGHBOR_AD"; payload: string }
    | { type: "DELETE_NEIGHBOR_AD"; payload: string }
    | { type: "REPORT_NEIGHBOR_AD"; payload: string }
    | { type: "ADD_VOTE"; payload: Vote }
    | { type: "CAST_VOTE"; payload: VoteCast }
    | { type: "SET_ENVIRONMENT_RATING"; payload: EnvironmentRatingSnapshot }
    | { type: "SET_UK_STATS"; payload: Partial<UkTransparencyStats> }
    | { type: "SET_NEWS"; payload: NewsItem[] }
    | { type: "SET_VOTES"; payload: { votes: Vote[]; casts: VoteCast[] } }
    | { type: "SET_NEIGHBOR_ADS"; payload: NeighborAd[] }
    | { type: "SET_APPEALS"; payload: Appeal[] }
    | { type: "SET_NOTIFICATIONS"; payload: AppNotification[] }
    | { type: "SET_DISTRICT"; payload: { pois: DistrictPoi[]; anchor: { lat: number; lng: number } | null } }
    | { type: "SET_HOUSE_DATA"; payload: { info?: BuildingInfo; photos?: string[]; specs?: BuildingSpec[]; schedule?: HouseScheduleItem[]; calendar?: HouseCalendarActivity[]; contacts?: UkContacts | null } }
    | { type: "REPLACE_APPEAL"; payload: Appeal };

function appealRecipientUserIds(appeal: Appeal): string[] {
    const ids = new Set<string>();
    if (appeal.authorUserId) ids.add(appeal.authorUserId);
    for (const p of appeal.participants) ids.add(p.userId);
    return [...ids];
}

function appendCollectiveEscalationNotifications(
    prev: AppNotification[],
    appeal: Appeal,
    userIds: string[],
): AppNotification[] {
    const t = Date.now();
    const n = collectiveUniqueApartmentCount(appeal);
    const extra: AppNotification[] = userIds.map((uid, i) => ({
        id: `coll_esc_${t}_${i}_${uid}`,
        title: "Коллективное обращение принято",
        body: `«${appeal.title}»: ${n} квартир в подъезде — статус «Принято», материалы переданы в УК.`,
        type: "general" as const,
        date: new Date().toISOString(),
        read: false,
        recipientUserId: uid,
    }));
    return [...extra, ...prev];
}

function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "REPLACE":
            return action.payload;
        case "SESSION_START":
            return { ...state, sessionActive: true };
        case "SESSION_END":
            return { ...state, account: null, sessionActive: false, voteCasts: [] };
        case "LOGIN":
            return {
                ...state,
                account: action.payload,
                sessionActive: true,
                voteCasts: [],
            };
        case "REGISTER":
            return {
                ...state,
                account: action.payload,
                sessionActive: true,
                voteCasts: [],
            };
        case "UPDATE_PROFILE":
            if (!state.account) return state;
            return {
                ...state,
                account: {
                    ...state.account,
                    profile: {
                        ...state.account.profile,
                        ...action.payload,
                    },
                },
            };
        case "CHANGE_PASSWORD":
            if (!state.account) return state;
            return {
                ...state,
                account: {
                    ...state.account,
                    password: action.payload,
                },
            };
        case "SUBMIT_VERIFICATION":
            return {
                ...state,
                verification: {
                    status: "pending",
                    docType: action.payload.docType,
                    submittedAt: new Date().toISOString(),
                },
            };
        case "ADD_APPEAL": {
            const id = `a_${Date.now()}`;
            const appeal: Appeal = {
                id,
                title: action.payload.title,
                body: action.payload.body,
                category: action.payload.category,
                status: "new",
                createdAt: new Date().toISOString(),
                kind: action.payload.kind,
                authorUserId: action.payload.authorUserId,
                buildingKey: action.payload.buildingKey,
                entrance: action.payload.entrance?.trim() || undefined,
                authorApartment: action.payload.authorApartment,
                participants: [],
                escalatedToUk: false,
                imageUrls: [],
            };
            return { ...state, appeals: [appeal, ...state.appeals] };
        }
        case "JOIN_APPEAL": {
            const { appealId, participant } = action.payload;
            const idx = state.appeals.findIndex((a) => a.id === appealId);
            if (idx < 0) return state;
            const cur = state.appeals[idx];
            if (cur.kind !== "collective") return state;
            if (cur.participants.some((p) => p.userId === participant.userId)) {
                return state;
            }
            const nextAppeal: Appeal = {
                ...cur,
                participants: [...cur.participants, participant],
            };
            let notifications = state.notifications;
            let status = nextAppeal.status;
            let escalatedToUk = nextAppeal.escalatedToUk ?? false;
            if (shouldEscalateToMassAppeal(nextAppeal)) {
                status = "accepted";
                escalatedToUk = true;
                const escalated: Appeal = {
                    ...nextAppeal,
                    status,
                    escalatedToUk,
                };
                const ids = appealRecipientUserIds(escalated);
                notifications = appendCollectiveEscalationNotifications(
                    notifications,
                    escalated,
                    ids,
                );
                const appeals = [...state.appeals];
                appeals[idx] = escalated;
                return { ...state, appeals, notifications };
            }
            const appeals = [...state.appeals];
            appeals[idx] = { ...nextAppeal, status, escalatedToUk };
            return { ...state, appeals, notifications };
        }
        case "DELETE_APPEAL":
            return {
                ...state,
                appeals: state.appeals.filter((a) => a.id !== action.payload),
            };
        case "MARK_NOTIF_READ":
            return {
                ...state,
                notifications: state.notifications.map((n) =>
                    n.id === action.payload ? { ...n, read: true } : n,
                ),
            };
        case "TOGGLE_PREF":
            return {
                ...state,
                notificationPrefs: {
                    ...state.notificationPrefs,
                    [action.payload]:
                        !state.notificationPrefs[action.payload],
                },
            };
        case "DELETE_ACCOUNT":
            return {
                ...initialState,
                notifications: [],
                news: seedNews,
                notificationPrefs: defaultPrefs,
                neighborAds: seedNeighborAds,
                votes: seedVotes,
                voteCasts: seedVoteCasts,
            };
        case "SET_VERIFICATION_STATUS":
            return { ...state, verification: action.payload };
        case "ARCHIVE_EXPIRED_NEIGHBOR_ADS":
            return {
                ...state,
                neighborAds: state.neighborAds.map((ad) =>
                    !ad.archived &&
                    !Number.isNaN(new Date(ad.expiresAt).getTime()) &&
                    new Date(ad.expiresAt).getTime() <= Date.now()
                        ? { ...ad, archived: true }
                        : ad,
                ),
            };
        case "ADD_NEIGHBOR_AD":
            return { ...state, neighborAds: [action.payload, ...state.neighborAds] };
        case "EXTEND_NEIGHBOR_AD":
            return {
                ...state,
                neighborAds: state.neighborAds.map((ad) =>
                    ad.id === action.payload
                        ? {
                              ...ad,
                              expiresAt: new Date(
                                  Date.now() + NEIGHBOR_AD_TTL_MS,
                              ).toISOString(),
                              archived: false,
                          }
                        : ad,
                ),
            };
        case "DELETE_NEIGHBOR_AD":
            return {
                ...state,
                neighborAds: state.neighborAds.filter(
                    (a) => a.id !== action.payload,
                ),
            };
        case "REPORT_NEIGHBOR_AD":
            return {
                ...state,
                neighborAds: state.neighborAds.map((ad) =>
                    ad.id === action.payload
                        ? { ...ad, pendingModeration: true }
                        : ad,
                ),
            };
        case "ADD_VOTE":
            return {
                ...state,
                votes: [action.payload, ...state.votes],
            };
        case "CAST_VOTE": {
            const exists = state.voteCasts.some(
                (c) =>
                    c.voteId === action.payload.voteId &&
                    c.userId === action.payload.userId,
            );
            if (exists) return state;
            return {
                ...state,
                voteCasts: [...state.voteCasts, action.payload],
            };
        }
        case "SET_ENVIRONMENT_RATING": {
            const next = action.payload;
            if (
                state.environmentRating &&
                state.environmentRating.monthKey === next.monthKey
            ) {
                return state;
            }
            return {
                ...state,
                environmentRating: next,
            };
        }
        case "SET_UK_STATS":
            return { ...state, ukStats: action.payload };
        case "SET_NEWS":
            return { ...state, news: action.payload };
        case "SET_VOTES":
            return {
                ...state,
                votes: action.payload.votes,
                voteCasts: action.payload.casts,
            };
        case "SET_NEIGHBOR_ADS":
            return { ...state, neighborAds: action.payload };
        case "SET_APPEALS":
            return { ...state, appeals: action.payload };
        case "SET_NOTIFICATIONS":
            return { ...state, notifications: action.payload };
        case "SET_DISTRICT":
            return { ...state, districtPois: action.payload.pois, districtAnchor: action.payload.anchor };
        case "SET_HOUSE_DATA":
            return {
                ...state,
                houseInfo: action.payload.info ?? state.houseInfo,
                housePhotos: action.payload.photos ?? state.housePhotos,
                houseSpecs: action.payload.specs ?? state.houseSpecs,
                houseSchedule: action.payload.schedule ?? state.houseSchedule,
                houseCalendar: action.payload.calendar ?? state.houseCalendar,
                ukContacts: action.payload.contacts !== undefined ? action.payload.contacts : state.ukContacts,
            };
        case "REPLACE_APPEAL": {
            const idx = state.appeals.findIndex((a) => a.id === action.payload.id);
            if (idx < 0) return state;
            const appeals = [...state.appeals];
            appeals[idx] = action.payload;
            return { ...state, appeals };
        }
        default:
            return state;
    }
}

function serialize(state: AppState): string {
    return JSON.stringify(state);
}

function normalizeAppealRaw(a: Appeal | Record<string, unknown>): Appeal {
    const r = a as Record<string, unknown>;
    const participants = Array.isArray(r.participants)
        ? (r.participants as AppealParticipant[])
        : [];
    return {
        id: String(r.id),
        title: String(r.title ?? ""),
        body: String(r.body ?? ""),
        category: String(r.category ?? ""),
        status: (r.status as Appeal["status"]) ?? "new",
        createdAt: String(r.createdAt ?? new Date().toISOString()),
        kind: (r.kind as AppealKind) ?? "personal",
        authorUserId: String(r.authorUserId ?? ""),
        buildingKey: String(r.buildingKey ?? ""),
        entrance: r.entrance ? String(r.entrance) : undefined,
        authorApartment: String(r.authorApartment ?? ""),
        participants,
        escalatedToUk: Boolean(r.escalatedToUk),
        imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
        resolvedAt: r.resolvedAt ? String(r.resolvedAt) : undefined,
        manuallyArchived: Boolean(r.manuallyArchived),
    };
}

const NEIGHBOR_AD_CATEGORIES: NeighborAdCategory[] = [
    "sell",
    "buy",
    "service",
    "invite",
    "lost",
    "found",
    "other",
];

function normalizeNeighborAdRaw(ad: NeighborAd | Record<string, unknown>): NeighborAd {
    const r = ad as Record<string, unknown>;
    const rawCat = r.category as NeighborAdCategory;
    const category = NEIGHBOR_AD_CATEGORIES.includes(rawCat) ? rawCat : "other";
    return {
        id: String(r.id),
        authorUserId: String(r.authorUserId ?? ""),
        buildingKey: String(r.buildingKey ?? ""),
        title: String(r.title ?? ""),
        body: String(r.body ?? ""),
        category,
        imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
        showPhone: Boolean(r.showPhone),
        authorPhone: r.authorPhone ? String(r.authorPhone) : undefined,
        createdAt: String(r.createdAt ?? new Date().toISOString()),
        expiresAt: String(r.expiresAt ?? new Date().toISOString()),
        archived: Boolean(r.archived),
        pendingModeration: Boolean(r.pendingModeration),
    };
}

function parseStored(raw: string): Partial<AppState> | null {
    try {
        const o = JSON.parse(raw) as Partial<AppState>;
        return o && typeof o === "object" ? o : null;
    } catch {
        return null;
    }
}

function normalizeVoteRaw(v: Vote | Record<string, unknown>): Vote {
    const r = v as Record<string, unknown>;
    const optsRaw = r.options;
    const options: VoteOption[] = Array.isArray(optsRaw)
        ? (optsRaw as Record<string, unknown>[])
              .filter(
                  (o) =>
                      o &&
                      typeof o.id === "string" &&
                      typeof o.label === "string",
              )
              .map((o) => ({
                  id: String(o.id),
                  label: String(o.label),
              }))
        : [];
    const sp = r.sponsor;
    const sponsor: VoteSponsor =
        sp === "uk" || sp === "residents"
            ? sp
            : inferVoteSponsorFromLabel(String(r.createdByLabel ?? ""));
    return {
        id: String(r.id ?? ""),
        buildingKey: String(r.buildingKey ?? ""),
        createdByLabel: String(r.createdByLabel ?? ""),
        topic: String(r.topic ?? ""),
        description: String(r.description ?? ""),
        options,
        endsAt: String(r.endsAt ?? new Date().toISOString()),
        visibility: r.visibility === "secret" ? "secret" : "open",
        createdAt: String(r.createdAt ?? new Date().toISOString()),
        closed: Boolean(r.closed),
        sponsor,
        trial: Boolean(r.trial),
    };
}

function mergeHydrated(parsed: Partial<AppState>): AppState {
    const appeals = (parsed.appeals ?? []).map((a) =>
        normalizeAppealRaw(a as Appeal | Record<string, unknown>),
    );
    const neighborAds = (parsed.neighborAds ?? []).map((a) =>
        normalizeNeighborAdRaw(a as NeighborAd | Record<string, unknown>),
    );
    const votes = (parsed.votes ?? []).map((x) =>
        normalizeVoteRaw(x as Vote | Record<string, unknown>),
    );
    return {
        ...initialState,
        ...parsed,
        appeals,
        neighborAds,
        votes,
        voteCasts: parsed.voteCasts ?? [],
        notifications: parsed.notifications ?? [],
        news: parsed.news ?? [],
        notificationPrefs: parsed.notificationPrefs ?? defaultPrefs,
        sessionActive: Boolean(parsed.sessionActive),
        verification: parsed.verification ?? { status: "none" },
        account: parsed.account ?? null,
        environmentRating: normalizeEnvironmentRating(parsed.environmentRating),
        districtPois: parsed.districtPois ?? [],
        districtAnchor: parsed.districtAnchor ?? null,
        houseInfo: parsed.houseInfo ?? null,
        housePhotos: parsed.housePhotos ?? [],
        houseSpecs: parsed.houseSpecs ?? [],
        houseSchedule: parsed.houseSchedule ?? [],
        houseCalendar: parsed.houseCalendar ?? [],
        ukContacts: parsed.ukContacts ?? null,
        ukStats: parsed.ukStats ?? {},
    };
}

const ALLOWED_RATING_FEEDBACK_TAGS: EnvironmentRatingFeedbackTagId[] = [
    "yard",
    "entrance",
    "uk_comm",
    "uk_work",
    "contractors",
    "safety",
    "other",
];

function monthKeyFromSubmittedAt(iso: string): string | null {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}-${m < 10 ? `0${m}` : m}`;
}

function normalizeFeedbackTagIds(
    raw: unknown,
): EnvironmentRatingFeedbackTagId[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const set = new Set(ALLOWED_RATING_FEEDBACK_TAGS);
    const out = raw.filter(
        (id): id is EnvironmentRatingFeedbackTagId =>
            typeof id === "string" && set.has(id as EnvironmentRatingFeedbackTagId),
    );
    return out.length > 0 ? out : undefined;
}

function normalizeEnvironmentRating(
    x: unknown,
): EnvironmentRatingSnapshot | null {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    const c = Number(o.courtyardStars);
    const e = Number(o.entranceStars);
    const uRaw = o.ukStars;
    const u =
        uRaw === undefined || uRaw === null
            ? 4
            : Number(uRaw);
    if (
        ![1, 2, 3, 4, 5].includes(c) ||
        ![1, 2, 3, 4, 5].includes(e) ||
        ![1, 2, 3, 4, 5].includes(u)
    ) {
        return null;
    }
    const submittedAt = String(o.submittedAt ?? new Date().toISOString());
    const mkRaw = o.monthKey;
    const monthKey =
        typeof mkRaw === "string" && /^\d{4}-\d{2}$/.test(mkRaw)
            ? mkRaw
            : monthKeyFromSubmittedAt(submittedAt) ?? "1970-01";
    const feedbackTagIds = normalizeFeedbackTagIds(o.feedbackTagIds);
    const otherRaw = o.feedbackOther;
    const feedbackOther =
        typeof otherRaw === "string" && otherRaw.trim().length > 0
            ? otherRaw.trim()
            : undefined;
    return {
        courtyardStars: c as EnvironmentRatingSnapshot["courtyardStars"],
        entranceStars: e as EnvironmentRatingSnapshot["entranceStars"],
        ukStars: u as EnvironmentRatingSnapshot["ukStars"],
        monthKey,
        feedbackTagIds,
        feedbackOther,
        submittedAt,
    };
}

function normalizeProfile(p: Profile | undefined): Profile {
    if (!p) {
        return { name: "", phone: "", building: "", apartment: "" };
    }
    const entrance = typeof p.entrance === "number" && p.entrance > 0 ? p.entrance : undefined;
    return {
        name: p.name ?? "",
        phone: p.phone ?? "",
        building: p.building ?? "",
        buildingName: p.buildingName || undefined,
        apartment: p.apartment ?? "",
        entrance,
        apartmentAreaSqm:
            typeof p.apartmentAreaSqm === "number" && !Number.isNaN(p.apartmentAreaSqm)
                ? p.apartmentAreaSqm
                : undefined,
    };
}

type AppContextValue = {
    hydrated: boolean;
    hasAccount: boolean;
    isAuthenticated: boolean;
    user: User | null;
    profile: Profile;
    verification: VerificationState;
    appeals: Appeal[];
    notifications: AppNotification[];
    visibleNotifications: AppNotification[];
    news: NewsItem[];
    notificationPrefs: NotificationPrefs;
    neighborAds: NeighborAd[];
    votes: import("../types").Vote[];
    voteCasts: VoteCast[];
    login: (email: string, password: string) => Promise<boolean>;
    register: (data: {
        email: string;
        password: string;
        name: string;
        phone: string;
        building: string;
        buildingKey?: string;
        apartment: string;
        entrance: number;
        dataConsentAt: string;
    }) => Promise<void>;
    logout: () => Promise<void>;
    updateProfile: (p: Partial<Profile>) => void;
    changePassword: (current: string, next: string) => Promise<boolean>;
    submitVerification: (docType: "lease" | "ownership", photoUrl: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
    addAppeal: (input: {
        title: string;
        body: string;
        category: string;
        kind: AppealKind;
        entrance?: string;
        imageUrls?: string[];
    }) => Promise<{ ok: true } | { ok: false; reason: string }>;
    joinAppeal: (appealId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
    deleteAppeal: (id: string) => void;
    archiveAppeal: (id: string) => void;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    toggleNotificationPref: (key: keyof NotificationPrefs) => void;
    deleteAccount: () => void;
    setVerificationDemo: (status: "pending" | "approved" | "rejected") => void;
    refreshFeed: () => Promise<void>;
    addNeighborAd: (input: {
        title: string;
        body: string;
        category: NeighborAdCategory;
        imageUrls?: string[];
        showPhone: boolean;
        authorPhone?: string;
    }) => Promise<{ ok: true } | { ok: false; reason: string }>;
    extendNeighborAd: (id: string) => void;
    deleteNeighborAd: (id: string) => void;
    reportNeighborAd: (id: string) => void;
    editNeighborAd: (id: string, data: { title: string; body: string; category: NeighborAdCategory; imageUrls?: string[]; showPhone: boolean; authorPhone?: string }) => Promise<{ ok: true } | { ok: false; reason: string }>;
    editAppeal: (id: string, data: { title: string; body: string; category: string; entrance?: string; imageUrls?: string[] }) => Promise<{ ok: true } | { ok: false; reason: string }>;
    editVote: (id: string, data: { topic: string; description: string; visibility: string; optionLabels: string[] }) => Promise<{ ok: true } | { ok: false; reason: string }>;
    deleteVote: (id: string) => Promise<void>;
    castVote: (input: {
        voteId: string;
        optionId: string;
    }) => { ok: true } | { ok: false; reason: string };
    addResidentVote: (
        input: ResidentVoteCreateInput,
    ) => Promise<{ ok: true } | { ok: false; reason: string }>;
    environmentRating: EnvironmentRatingSnapshot | null;
    ukStats: Partial<UkTransparencyStats>;
    setEnvironmentRating: (input: EnvironmentRatingSubmitInput) => void;
    districtPois: DistrictPoi[];
    districtAnchor: { lat: number; lng: number } | null;
    houseInfo: BuildingInfo | null;
    housePhotos: string[];
    houseSpecs: BuildingSpec[];
    houseSchedule: HouseScheduleItem[];
    houseCalendar: HouseCalendarActivity[];
    ukContacts: UkContacts | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [hydrated, setHydrated] = React.useState(false);
    const skipSave = useRef(true);

    useEffect(() => {
        void (async () => {
            let raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (!raw) raw = await AsyncStorage.getItem(STORAGE_KEY_LEGACY);
            if (raw) {
                const parsed = parseStored(raw);
                if (parsed) {
                    const merged = mergeHydrated(parsed);
                    const account = merged.account
                        ? {
                              ...merged.account,
                              profile: normalizeProfile(
                                  merged.account.profile,
                              ),
                          }
                        : null;
                    dispatch({
                        type: "REPLACE",
                        payload: { ...merged, account },
                    });
                }
            }
            skipSave.current = true;
            setHydrated(true);
        })();
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        dispatch({ type: "ARCHIVE_EXPIRED_NEIGHBOR_ADS" });
    }, [hydrated]);

    useEffect(() => {
        if (!state.sessionActive || !state.account) return;

        const onUnauthorized = (err: unknown) => {
            if (err instanceof ApiError && err.status === 401) {
                clearTokens().catch(() => {});
                dispatch({ type: "SESSION_END" });
            }
        };

        registerPushToken().catch(() => {});

        apiFetchNews()
            .then((items) => { if (items.length > 0) dispatch({ type: "SET_NEWS", payload: items }); })
            .catch((err) => { console.warn("[news] fetch failed:", err); onUnauthorized(err); });
        apiFetchVotes()
            .then((data) => { dispatch({ type: "SET_VOTES", payload: data }); })
            .catch((err) => { console.warn("[votes] fetch failed:", err); onUnauthorized(err); });
        apiFetchNeighborAds()
            .then((ads) => { if (ads.length > 0) dispatch({ type: "SET_NEIGHBOR_ADS", payload: ads }); })
            .catch((err) => { console.warn("[neighbor-ads] fetch failed:", err); onUnauthorized(err); });
        apiFetchAppeals()
            .then((list) => { dispatch({ type: "SET_APPEALS", payload: list }); })
            .catch((err) => { console.warn("[appeals] fetch failed:", err); onUnauthorized(err); });
        apiFetchMyRating()
            .then((r) => { if (r) dispatch({ type: "SET_ENVIRONMENT_RATING", payload: r }); })
            .catch(() => {});
        apiFetchRatingStats()
            .then((s) => dispatch({ type: "SET_UK_STATS", payload: s }))
            .catch(() => {});
        apiFetchNotifications()
            .then((items) => dispatch({ type: "SET_NOTIFICATIONS", payload: items }))
            .catch(() => {});
        apiFetchVerificationStatus()
            .then((v) => dispatch({ type: "SET_VERIFICATION_STATUS", payload: v }))
            .catch(() => {});
        apiFetchDistrictPois()
            .then(({ anchor, pois }) => dispatch({ type: "SET_DISTRICT", payload: { pois, anchor } }))
            .catch(() => {});
        Promise.all([
            apiFetchBuildingInfo(),
            apiFetchBuildingPhotos(),
            apiFetchBuildingSpecs(),
            apiFetchBuildingSchedule(),
            apiFetchBuildingCalendar("2020-01", "2030-12"),
            apiFetchBuildingContacts(),
        ]).then(([info, photos, specs, schedule, calendar, contacts]) => {
            dispatch({ type: "SET_HOUSE_DATA", payload: { info, photos, specs, schedule, calendar, contacts } });
        }).catch(() => {});
    }, [state.sessionActive, state.account?.user.id]);

    useEffect(() => {
        if (!hydrated) return;
        if (skipSave.current) {
            skipSave.current = false;
            return;
        }
        AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
    }, [state, hydrated]);

    const login = useCallback(
        async (email: string, password: string): Promise<boolean> => {
            try {
                const res = await apiLogin(email, password);
                const account: Account = {
                    user: { id: res.user.id, email: res.user.email },
                    profile: {
                        name: res.profile.name,
                        phone: res.profile.phone,
                        building: res.profile.building,
                        buildingName: res.profile.buildingName,
                        apartment: res.profile.apartment,
                        entrance: res.profile.entrance,
                        apartmentAreaSqm: res.profile.apartmentAreaSqm,
                        profilePhoto: res.profile.profilePhoto,
                    },
                    password: "",
                    dataConsentAt: undefined,
                };
                dispatch({ type: "LOGIN", payload: account });
                return true;
            } catch {
                return false;
            }
        },
        [],
    );

    const register = useCallback(
        async (data: {
            email: string;
            password: string;
            name: string;
            phone: string;
            building: string;
            buildingKey?: string;
            apartment: string;
            entrance: number;
            dataConsentAt: string;
        }): Promise<void> => {
            const res = await apiRegister(data);
            const account: Account = {
                user: { id: res.user.id, email: res.user.email },
                profile: {
                    name: res.profile.name,
                    phone: res.profile.phone,
                    building: res.profile.building,
                    buildingName: res.profile.buildingName,
                    apartment: res.profile.apartment,
                    entrance: res.profile.entrance,
                    apartmentAreaSqm: res.profile.apartmentAreaSqm,
                },
                password: "",
                dataConsentAt: data.dataConsentAt,
            };
            dispatch({ type: "REGISTER", payload: account });
        },
        [],
    );

    const logout = useCallback(async () => {
        await apiLogout().catch(() => {});
        await clearTokens().catch(() => {});
        dispatch({ type: "SESSION_END" });
    }, []);

    const updateProfile = useCallback((p: Partial<Profile>) => {
        dispatch({ type: "UPDATE_PROFILE", payload: p });
    }, []);

    const changePassword = useCallback(
        async (current: string, next: string): Promise<boolean> => {
            try {
                await apiChangePassword(current, next);
                return true;
            } catch {
                return false;
            }
        },
        [],
    );

    const submitVerification = useCallback(
        async (docType: "lease" | "ownership", photoUrl: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
            // оптимистично выставляем pending
            dispatch({ type: "SUBMIT_VERIFICATION", payload: { docType } });
            try {
                const result = await apiSubmitVerification({ docType, photoUrl });
                dispatch({ type: "SET_VERIFICATION_STATUS", payload: result });
                return { ok: true };
            } catch (e: any) {
                const reason: string = e?.message ?? "Ошибка отправки";
                // откатываем если ошибка
                dispatch({ type: "SET_VERIFICATION_STATUS", payload: { status: "none" } });
                return { ok: false, reason };
            }
        },
        [],
    );

    const addAppeal = useCallback(
        async (input: {
            title: string;
            body: string;
            category: string;
            kind: AppealKind;
            entrance?: string;
            imageUrls?: string[];
        }): Promise<{ ok: true } | { ok: false; reason: string }> => {
            if (!state.account?.user) return { ok: false, reason: "Войдите в аккаунт" };
            try {
                await apiCreateAppeal({
                    title: input.title,
                    body: input.body,
                    category: input.category,
                    kind: input.kind,
                    entrance: input.entrance,
                    imageUrls: input.imageUrls,
                });
                const updated = await apiFetchAppeals();
                dispatch({ type: "SET_APPEALS", payload: updated });
                return { ok: true };
            } catch (e: any) {
                return { ok: false, reason: e?.message ?? "Ошибка сервера" };
            }
        },
        [state.account],
    );

    const joinAppeal = useCallback(
        async (appealId: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
            if (!state.account?.user) {
                return { ok: false, reason: "Войдите в аккаунт" };
            }
            if (!isVerifiedResident(state.verification)) {
                return {
                    ok: false,
                    reason: "Присоединиться могут только верифицированные жильцы дома",
                };
            }
            const displayName = state.account.profile.name || "Жилец";
            // Оптимистичный диспатч — UI обновляется немедленно
            dispatch({
                type: "JOIN_APPEAL",
                payload: {
                    appealId,
                    participant: {
                        userId: String(state.account.user.id),
                        apartment: state.account.profile.apartment,
                        entrance: state.account.profile.entrance != null
                            ? String(state.account.profile.entrance) : undefined,
                        displayName,
                        anonymous: false,
                        joinedAt: new Date().toISOString(),
                    },
                },
            });
            // Синхронизация с сервером в фоне
            apiJoinAppeal(appealId, { anonymous: false, displayName })
                .then(() => apiFetchAppeals())
                .then((updated) => dispatch({ type: "SET_APPEALS", payload: updated }))
                .catch(() => {
                    apiFetchAppeals()
                        .then((updated) => dispatch({ type: "SET_APPEALS", payload: updated }))
                        .catch(() => {});
                });
            return { ok: true };
        },
        [state.account, state.verification],
    );

    const deleteAppeal = useCallback((id: string) => {
        dispatch({ type: "DELETE_APPEAL", payload: id });
        apiDeleteAppeal(id).catch(() => {});
    }, []);

    const archiveAppeal = useCallback((id: string) => {
        dispatch({
            type: "SET_APPEALS",
            payload: state.appeals.map((a) =>
                a.id === id ? { ...a, manuallyArchived: true } : a,
            ),
        });
        apiArchiveAppeal(id).catch(() => {});
    }, [state.appeals]);

    const markNotificationRead = useCallback((id: string) => {
        dispatch({ type: "MARK_NOTIF_READ", payload: id });
        apiMarkNotificationRead(id).catch(() => {});
    }, []);

    const markAllNotificationsRead = useCallback(() => {
        // оптимистично помечаем все прочитанными локально
        dispatch({ type: "SET_NOTIFICATIONS", payload: state.notifications.map((n) => ({ ...n, read: true })) });
        apiMarkAllNotificationsRead().catch(() => {});
    }, [state.notifications]);

    const toggleNotificationPref = useCallback(
        (key: keyof NotificationPrefs) => {
            dispatch({ type: "TOGGLE_PREF", payload: key });
        },
        [],
    );

    const deleteAccount = useCallback(() => {
        dispatch({ type: "DELETE_ACCOUNT" });
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }, []);

    const refreshFeed = useCallback(async () => {
        await Promise.all([
            apiFetchNews()
                .then((items) => dispatch({ type: "SET_NEWS", payload: items }))
                .catch(() => {}),
            apiFetchVotes()
                .then((data) => dispatch({ type: "SET_VOTES", payload: data }))
                .catch(() => {}),
            apiFetchNeighborAds()
                .then((ads) => dispatch({ type: "SET_NEIGHBOR_ADS", payload: ads }))
                .catch(() => {}),
            apiFetchAppeals()
                .then((list) => dispatch({ type: "SET_APPEALS", payload: list }))
                .catch(() => {}),
            apiFetchNotifications()
                .then((items) => dispatch({ type: "SET_NOTIFICATIONS", payload: items }))
                .catch(() => {}),
            apiFetchVerificationStatus()
                .then((v) => dispatch({ type: "SET_VERIFICATION_STATUS", payload: v }))
                .catch(() => {}),
            apiFetchRatingStats()
                .then((s) => dispatch({ type: "SET_UK_STATS", payload: s }))
                .catch(() => {}),
            apiFetchDistrictPois()
                .then(({ anchor, pois }) => dispatch({ type: "SET_DISTRICT", payload: { pois, anchor } }))
                .catch(() => {}),
            Promise.all([
                apiFetchBuildingInfo(),
                apiFetchBuildingPhotos(),
                apiFetchBuildingSpecs(),
                apiFetchBuildingSchedule(),
                apiFetchBuildingCalendar("2020-01", "2030-12"),
                apiFetchBuildingContacts(),
            ]).then(([info, photos, specs, schedule, calendar, contacts]) => {
                dispatch({ type: "SET_HOUSE_DATA", payload: { info, photos, specs, schedule, calendar, contacts } });
            }).catch(() => {}),
        ]);
    }, []);

    const setVerificationDemo = useCallback(
        (status: "pending" | "approved" | "rejected") => {
            const base = state.verification;
            dispatch({
                type: "SET_VERIFICATION_STATUS",
                payload:
                    status === "rejected"
                        ? {
                              ...base,
                              status: "rejected",
                              comment:
                                  "Качество скана недостаточное. Загрузите документ заново.",
                          }
                        : status === "approved"
                          ? {
                                ...base,
                                status: "approved",
                                comment: undefined,
                            }
                          : {
                                ...base,
                                status: "pending",
                                submittedAt:
                                    base.submittedAt ?? new Date().toISOString(),
                            },
            });
        },
        [state.verification],
    );

    const addNeighborAd = useCallback(
        async (input: {
            title: string;
            body: string;
            category: NeighborAdCategory;
            imageUrls?: string[];
            showPhone: boolean;
            authorPhone?: string;
        }): Promise<{ ok: true } | { ok: false; reason: string }> => {
            if (!state.account?.user) {
                return { ok: false, reason: "Войдите в аккаунт" };
            }
            if (!isVerifiedResident(state.verification)) {
                return {
                    ok: false,
                    reason: "Публиковать могут только верифицированные жильцы",
                };
            }
            try {
                const newAd = await apiCreateNeighborAd({
                    title: input.title.trim(),
                    body: input.body.trim(),
                    category: input.category,
                    imageUrls: input.imageUrls,
                    showPhone: input.showPhone,
                    authorPhone: input.showPhone ? (input.authorPhone?.trim() || undefined) : undefined,
                });
                dispatch({
                    type: "ADD_NEIGHBOR_AD",
                    payload: normalizeNeighborAdRaw(newAd),
                });
                return { ok: true };
            } catch (e: any) {
                return { ok: false, reason: e?.message ?? "Ошибка сервера" };
            }
        },
        [state.account, state.verification],
    );

    const extendNeighborAd = useCallback((id: string) => {
        dispatch({ type: "EXTEND_NEIGHBOR_AD", payload: id });
        apiExtendNeighborAd(id).catch(() => {});
    }, []);

    const deleteNeighborAd = useCallback((id: string) => {
        dispatch({ type: "DELETE_NEIGHBOR_AD", payload: id });
        apiDeleteNeighborAd(id).catch(() => {});
    }, []);

    const reportNeighborAd = useCallback((id: string) => {
        dispatch({ type: "REPORT_NEIGHBOR_AD", payload: id });
        apiReportNeighborAd(id).catch(() => {});
    }, []);

    const editNeighborAd = useCallback(
        async (id: string, data: { title: string; body: string; category: NeighborAdCategory; imageUrls?: string[]; showPhone: boolean; authorPhone?: string }): Promise<{ ok: true } | { ok: false; reason: string }> => {
            try {
                const updated = await apiEditNeighborAd(id, data);
                dispatch({ type: "SET_NEIGHBOR_ADS", payload: (await apiFetchNeighborAds()) });
                void updated;
                return { ok: true };
            } catch (e: any) {
                return { ok: false, reason: e?.message ?? "Ошибка сервера" };
            }
        }, [],
    );

    const editAppeal = useCallback(
        async (id: string, data: { title: string; body: string; category: string; entrance?: string; imageUrls?: string[] }): Promise<{ ok: true } | { ok: false; reason: string }> => {
            try {
                await apiEditAppeal(id, data);
                const list = await apiFetchAppeals();
                dispatch({ type: "SET_APPEALS", payload: list });
                return { ok: true };
            } catch (e: any) {
                return { ok: false, reason: e?.message ?? "Ошибка сервера" };
            }
        }, [],
    );

    const editVote = useCallback(
        async (id: string, data: { topic: string; description: string; visibility: string; optionLabels: string[] }): Promise<{ ok: true } | { ok: false; reason: string }> => {
            try {
                await apiEditVote(id, data);
                const result = await apiFetchVotes();
                dispatch({ type: "SET_VOTES", payload: result });
                return { ok: true };
            } catch (e: any) {
                return { ok: false, reason: e?.message ?? "Ошибка сервера" };
            }
        }, [],
    );

    const deleteVote = useCallback(async (id: string): Promise<void> => {
        try {
            await apiDeleteVote(id);
            const result = await apiFetchVotes();
            dispatch({ type: "SET_VOTES", payload: result });
        } catch {
            // ignore
        }
    }, []);

    const castVote = useCallback(
        (input: {
            voteId: string;
            optionId: string;
        }): { ok: true } | { ok: false; reason: string } => {
            if (!state.account?.user) {
                return { ok: false, reason: "Войдите в аккаунт" };
            }
            if (!isVerifiedResident(state.verification)) {
                return {
                    ok: false,
                    reason: "Голосование доступно после подтверждения статуса жильца в разделе «Верификация»",
                };
            }
            const vote = state.votes.find((v) => v.id === input.voteId);
            if (!vote) return { ok: false, reason: "Голосование не найдено" };
            const ended =
                vote.closed ||
                new Date(vote.endsAt).getTime() <= Date.now();
            if (ended) return { ok: false, reason: "Срок голосования истёк" };
            const myKey = buildBuildingKey(state.account.profile.building);
            const voteKey = buildBuildingKey(vote.buildingKey);
            if (voteKey !== myKey) {
                return { ok: false, reason: "Голосование другого дома" };
            }
            if (
                !vote.options.some((o) => o.id === input.optionId)
            ) {
                return { ok: false, reason: "Некорректный вариант" };
            }
            const areaSqm =
                state.account.profile.apartmentAreaSqm &&
                state.account.profile.apartmentAreaSqm > 0
                    ? state.account.profile.apartmentAreaSqm
                    : 42;
            const cast = {
                voteId: input.voteId,
                userId: String(state.account.user.id),
                optionId: input.optionId,
                votedAt: new Date().toISOString(),
                areaSqm,
            };
            dispatch({ type: "CAST_VOTE", payload: cast });
            apiCastVote({ voteId: input.voteId, optionId: input.optionId, areaSqm }).catch(() => {});
            return { ok: true };
        },
        [state.account, state.verification, state.votes],
    );

    const addResidentVote = useCallback(
        async (
            input: ResidentVoteCreateInput,
        ): Promise<{ ok: true } | { ok: false; reason: string }> => {
            if (!state.account?.user) {
                return { ok: false, reason: "Войдите в аккаунт" };
            }
            if (!isVerifiedResident(state.verification)) {
                return {
                    ok: false,
                    reason:
                        "Создавать опросы могут жильцы с подтверждённой верификацией. Для юридически значимого ОСС действует отдельная процедура (ГИС ЖКХ, УК).",
                };
            }
            const topic = input.topic.trim();
            const description = input.description.trim();
            if (!topic || !description) {
                return { ok: false, reason: "Укажите тему и описание" };
            }
            const labels = input.optionLabels
                .map((s) => s.trim())
                .filter(Boolean);
            if (labels.length < 2 || labels.length > 4) {
                return {
                    ok: false,
                    reason: "Нужно от 2 до 4 вариантов ответа (подписи вариантов)",
                };
            }
            const prof = state.account.profile;
            const namePart = prof.name?.trim();
            const createdByLabel = namePart
                ? `${namePart}, кв. ${prof.apartment || "—"}`
                : `Кв. ${prof.apartment || "—"}`;
            try {
                const serverVote = await apiCreateVote({
                    topic,
                    description,
                    visibility: input.visibility,
                    optionLabels: labels,
                    durationDays: input.durationDays,
                    createdByLabel,
                });
                dispatch({ type: "ADD_VOTE", payload: normalizeVoteRaw(serverVote) });
                return { ok: true };
            } catch (e: any) {
                return { ok: false, reason: e?.message ?? "Ошибка создания голосования" };
            }
        },
        [state.account, state.verification],
    );

    const setEnvironmentRating = useCallback((input: EnvironmentRatingSubmitInput) => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const monthKey = `${y}-${m < 10 ? `0${m}` : m}`;
        const tags = input.feedbackTagIds?.filter((id) =>
            ALLOWED_RATING_FEEDBACK_TAGS.includes(id),
        );
        const otherTrim = input.feedbackOther?.trim();
        const snapshot = {
            courtyardStars: input.courtyardStars,
            entranceStars: input.entranceStars,
            ukStars: input.ukStars,
            monthKey,
            feedbackTagIds: tags && tags.length > 0 ? tags : undefined,
            feedbackOther: otherTrim && otherTrim.length > 0 ? otherTrim : undefined,
            submittedAt: now.toISOString(),
        };
        dispatch({ type: "SET_ENVIRONMENT_RATING", payload: snapshot });
        apiSubmitRating({
            monthKey,
            courtyardStars: input.courtyardStars,
            entranceStars: input.entranceStars,
            ukStars: input.ukStars,
            feedbackTagIds: tags && tags.length > 0 ? (tags as string[]) : undefined,
            feedbackOther: otherTrim && otherTrim.length > 0 ? otherTrim : undefined,
        }).catch(() => {});
    }, []);

    const visibleNotifications = useMemo(() => {
        const uid = state.account?.user.id;
        return state.notifications.filter((n) => {
            if (n.recipientUserId && n.recipientUserId !== uid) return false;
            if (n.type === "outage" && !state.notificationPrefs.outages)
                return false;
            if (n.type === "meeting" && !state.notificationPrefs.meetings)
                return false;
            if (
                n.type === "announcement" &&
                !state.notificationPrefs.announcements
            )
                return false;
            if (n.type === "general" && !state.notificationPrefs.general)
                return false;
            return true;
        });
    }, [
        state.notifications,
        state.notificationPrefs,
        state.account?.user.id,
    ]);

    const isAuthenticated =
        state.sessionActive && state.account !== null;
    const user = isAuthenticated ? state.account!.user : null;
    const profile =
        state.account?.profile != null
            ? normalizeProfile(state.account.profile)
            : { name: "", phone: "", building: "", apartment: "" };

    const hasAccount = state.account !== null;

    const value = useMemo<AppContextValue>(
        () => ({
            hydrated,
            hasAccount,
            isAuthenticated,
            user,
            profile,
            verification: state.verification,
            appeals: state.appeals,
            notifications: state.notifications,
            visibleNotifications,
            news: state.news,
            notificationPrefs: state.notificationPrefs,
            neighborAds: state.neighborAds,
            votes: state.votes,
            voteCasts: state.voteCasts,
            login,
            register,
            logout,
            updateProfile,
            changePassword,
            submitVerification,
            addAppeal,
            joinAppeal,
            deleteAppeal,
            archiveAppeal,
            markNotificationRead,
            markAllNotificationsRead,
            toggleNotificationPref,
            deleteAccount,
            setVerificationDemo,
            refreshFeed,
            addNeighborAd,
            extendNeighborAd,
            deleteNeighborAd,
            reportNeighborAd,
            editNeighborAd,
            editAppeal,
            editVote,
            deleteVote,
            castVote,
            addResidentVote,
            environmentRating: state.environmentRating,
            ukStats: state.ukStats,
            setEnvironmentRating,
            districtPois: state.districtPois,
            districtAnchor: state.districtAnchor,
            houseInfo: state.houseInfo,
            housePhotos: state.housePhotos,
            houseSpecs: state.houseSpecs,
            houseSchedule: state.houseSchedule,
            houseCalendar: state.houseCalendar,
            ukContacts: state.ukContacts,
        }),
        [
            hydrated,
            hasAccount,
            isAuthenticated,
            user,
            profile,
            state.verification,
            state.appeals,
            state.notifications,
            visibleNotifications,
            state.news,
            state.notificationPrefs,
            state.neighborAds,
            state.votes,
            state.voteCasts,
            state.environmentRating,
            state.ukStats,
            login,
            register,
            logout,
            updateProfile,
            changePassword,
            submitVerification,
            addAppeal,
            joinAppeal,
            deleteAppeal,
            archiveAppeal,
            markNotificationRead,
            markAllNotificationsRead,
            toggleNotificationPref,
            deleteAccount,
            setVerificationDemo,
            refreshFeed,
            addNeighborAd,
            extendNeighborAd,
            deleteNeighborAd,
            reportNeighborAd,
            editNeighborAd,
            editAppeal,
            editVote,
            deleteVote,
            castVote,
            addResidentVote,
            setEnvironmentRating,
            state.districtPois,
            state.districtAnchor,
            state.houseInfo,
            state.housePhotos,
            state.houseSpecs,
            state.houseSchedule,
            state.houseCalendar,
        ],
    );

    return (
        <AppContext.Provider value={value}>{children}</AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp outside AppProvider");
    return ctx;
}
