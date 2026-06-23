import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Нагрузка на создание и удаление: объявление, обращение, голосование.
 * Меньше VU, чем app-startup — запись в БД тяжелее чтения.
 *
 *   MODERATION_ENABLED=0 в .env
 *   TEST_EMAIL, TEST_PASSWORD
 */
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3001";
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

const PROFILES = {
    load: [
        { duration: "30s", target: 10 },
        { duration: "2m", target: 10 },
        { duration: "30s", target: 0 },
    ],
    peak: [
        { duration: "1m", target: 20 },
        { duration: "2m", target: 20 },
        { duration: "30s", target: 0 },
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
        http_req_duration: ["p(95)<3000", "p(99)<5000"],
    },
};

export function setup() {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
        throw new Error("Задайте TEST_EMAIL и TEST_PASSWORD");
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

function jsonHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}

function createAndDelete(token, path, body, checkName) {
    const headers = jsonHeaders(token);
    const createRes = http.post(`${BASE_URL}${path}`, JSON.stringify(body), { headers });
    const created = check(createRes, { [`${checkName} create 201`]: (r) => r.status === 201 });
    if (!created) return;

    let id;
    try {
        id = createRes.json("id");
    } catch {
        return;
    }
    if (!id) return;

    const deleteRes = http.del(`${BASE_URL}${path}/${id}`, null, { headers });
    check(deleteRes, { [`${checkName} delete ok`]: (r) => r.status === 200 || r.status === 204 });
}

export default function (data) {
    const tag = `k6-${__VU}-${__ITER}-${Date.now()}`;

    createAndDelete(data.token, "/api/neighbor-ads", {
        title: `${tag} объявление`,
        body: "Нагрузочный тест создания объявления",
        category: "other",
    }, "ad");

    createAndDelete(data.token, "/api/appeals", {
        title: `${tag} обращение`,
        body: "Нагрузочный тест создания обращения",
        category: "plumbing",
        kind: "personal",
    }, "appeal");

    createAndDelete(data.token, "/api/votes", {
        topic: `${tag} голосование`,
        description: "Нагрузочный тест создания голосования",
        visibility: "open",
        optionLabels: ["Да", "Нет"],
        durationDays: 3,
    }, "vote");

    sleep(Number(__ENV.SLEEP || 2));
}
