import AsyncStorage from "@react-native-async-storage/async-storage";
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
    seedAppeals,
    seedNews,
    seedNotifications,
} from "../data/mockData";
import type {
    Appeal,
    AppNotification,
    NewsItem,
    NotificationPrefs,
    Profile,
    User,
    VerificationState,
} from "../types";

const STORAGE_KEY = "@domovoy/app_state_v1";

type Account = {
    user: User;
    profile: Profile;
    password: string;
};

type AppState = {
    account: Account | null;
    sessionActive: boolean;
    verification: VerificationState;
    appeals: Appeal[];
    notifications: AppNotification[];
    news: NewsItem[];
    notificationPrefs: NotificationPrefs;
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
    appeals: seedAppeals,
    notifications: seedNotifications,
    news: seedNews,
    notificationPrefs: defaultPrefs,
};

type Action =
    | { type: "REPLACE"; payload: AppState }
    | { type: "SESSION_START" }
    | { type: "SESSION_END" }
    | { type: "REGISTER"; payload: Account }
    | { type: "UPDATE_PROFILE"; payload: Partial<Profile> }
    | { type: "CHANGE_PASSWORD"; payload: string }
    | {
          type: "SUBMIT_VERIFICATION";
          payload: { docType: "lease" | "ownership" };
      }
    | {
          type: "ADD_APPEAL";
          payload: { title: string; body: string; category: string };
      }
    | { type: "DELETE_APPEAL"; payload: string }
    | { type: "MARK_NOTIF_READ"; payload: string }
    | { type: "TOGGLE_PREF"; payload: keyof NotificationPrefs }
    | { type: "DELETE_ACCOUNT" }
    | {
          type: "SET_VERIFICATION_STATUS";
          payload: VerificationState;
      };

function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
        case "REPLACE":
            return action.payload;
        case "SESSION_START":
            return { ...state, sessionActive: true };
        case "SESSION_END":
            return { ...state, sessionActive: false };
        case "REGISTER":
            return {
                ...state,
                account: action.payload,
                sessionActive: true,
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
            };
            return { ...state, appeals: [appeal, ...state.appeals] };
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
                notifications: seedNotifications,
                news: seedNews,
                notificationPrefs: defaultPrefs,
            };
        case "SET_VERIFICATION_STATUS":
            return { ...state, verification: action.payload };
        default:
            return state;
    }
}

function serialize(state: AppState): string {
    return JSON.stringify(state);
}

function parseStored(raw: string): AppState | null {
    try {
        const o = JSON.parse(raw) as AppState;
        return o && typeof o === "object" ? o : null;
    } catch {
        return null;
    }
}

function normalizeProfile(p: Profile | undefined): Profile {
    if (!p) {
        return { name: "", phone: "", building: "", apartment: "" };
    }
    return {
        name: p.name ?? "",
        phone: p.phone ?? "",
        building: p.building ?? "",
        apartment: p.apartment ?? "",
    };
}

type AppContextValue = {
    hydrated: boolean;
    /** Есть сохранённая учётная запись (можно войти после выхода) */
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
    login: (email: string, password: string) => boolean;
    register: (data: {
        email: string;
        password: string;
        name: string;
        phone: string;
        building: string;
        apartment: string;
    }) => void;
    logout: () => void;
    updateProfile: (p: Partial<Profile>) => void;
    changePassword: (current: string, next: string) => boolean;
    submitVerification: (docType: "lease" | "ownership") => void;
    addAppeal: (title: string, body: string, category: string) => void;
    deleteAppeal: (id: string) => void;
    markNotificationRead: (id: string) => void;
    toggleNotificationPref: (key: keyof NotificationPrefs) => void;
    deleteAccount: () => void;
    /** Только для демо UI без бэкенда — имитация ответа УК */
    setVerificationDemo: (status: "pending" | "approved" | "rejected") => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [hydrated, setHydrated] = React.useState(false);
    const skipSave = useRef(true);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
            if (raw) {
                const parsed = parseStored(raw);
                if (parsed) {
                    const account = parsed.account
                        ? {
                              ...parsed.account,
                              profile: normalizeProfile(
                                  parsed.account.profile,
                              ),
                          }
                        : null;
                    dispatch({
                        type: "REPLACE",
                        payload: {
                            ...initialState,
                            ...parsed,
                            account,
                            news: seedNews,
                        },
                    });
                }
            }
            skipSave.current = true;
            setHydrated(true);
        });
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        if (skipSave.current) {
            skipSave.current = false;
            return;
        }
        AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
    }, [state, hydrated]);

    const login = useCallback(
        (email: string, password: string) => {
            const acc = state.account;
            if (!acc) return false;
            if (acc.user.email.toLowerCase() !== email.trim().toLowerCase()) {
                return false;
            }
            if (acc.password !== password) return false;
            dispatch({ type: "SESSION_START" });
            return true;
        },
        [state.account],
    );

    const register = useCallback(
        (data: {
            email: string;
            password: string;
            name: string;
            phone: string;
            building: string;
            apartment: string;
        }) => {
            const user: User = {
                id: `u_${Date.now()}`,
                email: data.email.trim().toLowerCase(),
            };
            const account: Account = {
                user,
                profile: {
                    name: data.name.trim(),
                    phone: data.phone.trim(),
                    building: data.building.trim(),
                    apartment: data.apartment.trim(),
                },
                password: data.password,
            };
            dispatch({ type: "REGISTER", payload: account });
        },
        [],
    );

    const logout = useCallback(() => {
        dispatch({ type: "SESSION_END" });
    }, []);

    const updateProfile = useCallback((p: Partial<Profile>) => {
        dispatch({ type: "UPDATE_PROFILE", payload: p });
    }, []);

    const changePassword = useCallback(
        (current: string, next: string) => {
            if (!state.account || current !== state.account.password) {
                return false;
            }
            dispatch({ type: "CHANGE_PASSWORD", payload: next });
            return true;
        },
        [state.account],
    );

    const submitVerification = useCallback(
        (docType: "lease" | "ownership") => {
            dispatch({ type: "SUBMIT_VERIFICATION", payload: { docType } });
        },
        [],
    );

    const addAppeal = useCallback(
        (title: string, body: string, category: string) => {
            dispatch({
                type: "ADD_APPEAL",
                payload: { title, body, category },
            });
        },
        [],
    );

    const deleteAppeal = useCallback((id: string) => {
        dispatch({ type: "DELETE_APPEAL", payload: id });
    }, []);

    const markNotificationRead = useCallback((id: string) => {
        dispatch({ type: "MARK_NOTIF_READ", payload: id });
    }, []);

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

    const visibleNotifications = useMemo(() => {
        return state.notifications.filter((n) => {
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
    }, [state.notifications, state.notificationPrefs]);

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
            login,
            register,
            logout,
            updateProfile,
            changePassword,
            submitVerification,
            addAppeal,
            deleteAppeal,
            markNotificationRead,
            toggleNotificationPref,
            deleteAccount,
            setVerificationDemo,
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
            login,
            register,
            logout,
            updateProfile,
            changePassword,
            submitVerification,
            addAppeal,
            deleteAppeal,
            markNotificationRead,
            toggleNotificationPref,
            deleteAccount,
            setVerificationDemo,
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
