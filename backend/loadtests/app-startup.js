import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Имитирует открытие приложения: login + параллельная загрузка данных (как fetchAllData в AppContext).
 *
 * Переменные окружения:
 *   BASE_URL       — http://127.0.0.1:3001 или прод
 *   TEST_EMAIL     — тестовый пользователь
 *   TEST_PASSWORD  — пароль
 */
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3001";
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

/** quick — локальная отладка; load — нормальная проверка; peak — пиковая нагрузка */
const PROFILES = {
    quick: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 0 },
    ],
    load: [
        { duration: "1m", target: 30 },
        { duration: "3m", target: 30 },
        { duration: "30s", target: 0 },
    ],
    peak: [
        { duration: "1m", target: 50 },
        { duration: "2m", target: 50 },
        { duration: "1m", target: 0 },
    ],
};

function resolveStages() {
    const profileName = __ENV.LOAD_PROFILE || "load";
    const base = PROFILES[profileName] ?? PROFILES.load;
    if (!__ENV.VUS) return base;
    const vus = Number(__ENV.VUS);
    return base.map((stage) => ({
        ...stage,
        target: stage.target === 0 ? 0 : vus,
    }));
}

export const options = {
    stages: resolveStages(),
    thresholds: {
        http_req_failed: ["rate<0.05"],
        http_req_duration: ["p(95)<800", "p(99)<1500"],
    },
};

export function setup() {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
        throw new Error("Задайте TEST_EMAIL и TEST_PASSWORD (тестовый аккаунт, не прод-пользователи).");
    }

    const loginRes = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
        { headers: { "Content-Type": "application/json" } },
    );

    check(loginRes, { "login 200": (r) => r.status === 200 });

    if (loginRes.status !== 200) {
        throw new Error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    }

    return { token: loginRes.json("accessToken") };
}

export default function (data) {
    const headers = {
        Authorization: `Bearer ${data.token}`,
        "Content-Type": "application/json",
    };

    const batch = http.batch([
        ["GET", `${BASE_URL}/api/news`, null, { headers }],
        ["GET", `${BASE_URL}/api/votes`, null, { headers }],
        ["GET", `${BASE_URL}/api/neighbor-ads`, null, { headers }],
        ["GET", `${BASE_URL}/api/appeals`, null, { headers }],
        ["GET", `${BASE_URL}/api/ratings/my`, null, { headers }],
        ["GET", `${BASE_URL}/api/ratings/stats`, null, { headers }],
        ["GET", `${BASE_URL}/api/notifications`, null, { headers }],
        ["GET", `${BASE_URL}/api/notifications/prefs`, null, { headers }],
        ["GET", `${BASE_URL}/api/verification/status`, null, { headers }],
        ["GET", `${BASE_URL}/api/apartments`, null, { headers }],
        ["GET", `${BASE_URL}/api/district/pois`, null, { headers }],
        ["GET", `${BASE_URL}/api/buildings/info`, null, { headers }],
        ["GET", `${BASE_URL}/api/buildings/photos`, null, { headers }],
        ["GET", `${BASE_URL}/api/buildings/specs`, null, { headers }],
        ["GET", `${BASE_URL}/api/buildings/schedule`, null, { headers }],
        ["GET", `${BASE_URL}/api/buildings/calendar?from=2020-01&to=2030-12`, null, { headers }],
        ["GET", `${BASE_URL}/api/buildings/contacts`, null, { headers }],
        ["GET", `${BASE_URL}/api/buildings/chats`, null, { headers }],
    ]);

    check(batch[0], { "news 200": (r) => r.status === 200 });
    check(batch[1], { "votes 200": (r) => r.status === 200 });

    sleep(Number(__ENV.SLEEP || 1));
}
