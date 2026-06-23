/**
 * Быстрый нагрузочный тест без k6 — имитирует открытие приложения.
 *
 * Использование:
 *   set TEST_EMAIL=you@test.com
 *   set TEST_PASSWORD=secret
 *   node loadtests/run-app-startup.mjs
 *
 * Опции через env:
 *   BASE_URL, CONCURRENCY (по умолчанию 10), DURATION_SEC (30)
 */
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const DURATION_SEC = Number(process.env.DURATION_SEC || 30);
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

const ENDPOINTS = [
    "/api/news",
    "/api/votes",
    "/api/neighbor-ads",
    "/api/appeals",
    "/api/ratings/my",
    "/api/ratings/stats",
    "/api/notifications",
    "/api/notifications/prefs",
    "/api/verification/status",
    "/api/apartments",
    "/api/district/pois",
    "/api/buildings/info",
    "/api/buildings/photos",
    "/api/buildings/specs",
    "/api/buildings/schedule",
    "/api/buildings/calendar?from=2020-01&to=2030-12",
    "/api/buildings/contacts",
    "/api/buildings/chats",
];

async function login() {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (!res.ok) {
        throw new Error(`Login failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.accessToken;
}

async function runStartup(token) {
    const headers = { Authorization: `Bearer ${token}` };
    const started = performance.now();
    const results = await Promise.allSettled(
        ENDPOINTS.map((path) =>
            fetch(`${BASE_URL}${path}`, { headers }).then(async (r) => ({
                path,
                status: r.status,
                ms: performance.now() - started,
            })),
        ),
    );
    const failed = results.filter((r) => r.status === "rejected" || r.value.status >= 400);
    return { ok: failed.length === 0, failed: failed.length, total: ENDPOINTS.length };
}

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

async function main() {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
        console.error("Задайте TEST_EMAIL и TEST_PASSWORD");
        process.exit(1);
    }

    console.log(`Target: ${BASE_URL}, VUs: ${CONCURRENCY}, duration: ${DURATION_SEC}s`);
    const token = await login();
    console.log("Login OK\n");

    const latencies = [];
    let iterations = 0;
    let errors = 0;
    const deadline = Date.now() + DURATION_SEC * 1000;

    async function worker() {
        while (Date.now() < deadline) {
            const t0 = performance.now();
            try {
                const result = await runStartup(token);
                latencies.push(performance.now() - t0);
                if (!result.ok) errors += 1;
            } catch {
                errors += 1;
            }
            iterations += 1;
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    latencies.sort((a, b) => a - b);
    const rps = (iterations / DURATION_SEC).toFixed(1);

    console.log("--- Results ---");
    console.log(`Iterations: ${iterations} (${rps} startup/s)`);
    console.log(`Errors:     ${errors}`);
    console.log(`Latency ms: p50=${percentile(latencies, 50).toFixed(0)} p95=${percentile(latencies, 95).toFixed(0)} p99=${percentile(latencies, 99).toFixed(0)} max=${latencies.at(-1)?.toFixed(0) ?? 0}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
