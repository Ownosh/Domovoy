/**
 * Проверка готовности к нагрузочным тестам: health, login, все endpoint'ы старта приложения.
 *
 *   set TEST_EMAIL=...
 *   set TEST_PASSWORD=...
 *   node loadtests/diagnose.mjs
 */
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";
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

async function checkHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    const body = await res.json().catch(() => ({}));
    const ok = res.status === 200 && body.ok === true;
    console.log(ok ? "✓ /health OK" : `✗ /health ${res.status} ${JSON.stringify(body)}`);
    return ok;
}

async function checkLogin() {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
        console.log("⚠ TEST_EMAIL / TEST_PASSWORD не заданы — пропуск API с авторизацией");
        console.log("  Для loadtest:app и k6:app нужен тестовый пользователь из таблицы users");
        return null;
    }

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    const text = await res.text();
    if (!res.ok) {
        console.log(`✗ login ${res.status}: ${text.slice(0, 200)}`);
        return null;
    }
    const data = JSON.parse(text);
    console.log("✓ login OK");
    return data.accessToken;
}

async function checkEndpoints(token) {
    const headers = { Authorization: `Bearer ${token}` };
    let failed = 0;

    for (const path of ENDPOINTS) {
        const started = performance.now();
        try {
            const res = await fetch(`${BASE_URL}${path}`, { headers });
            const ms = (performance.now() - started).toFixed(0);
            const snippet = res.status >= 400 ? (await res.text()).slice(0, 120) : "";
            const mark = res.ok ? "✓" : "✗";
            console.log(`${mark} ${path} ${res.status} (${ms} ms)${snippet ? ` ${snippet}` : ""}`);
            if (!res.ok) failed += 1;
        } catch (err) {
            console.log(`✗ ${path} ERROR ${err instanceof Error ? err.message : err}`);
            failed += 1;
        }
    }

    return failed;
}

async function main() {
    console.log(`Target: ${BASE_URL}\n`);

    const healthOk = await checkHealth();
    if (!healthOk) {
        console.log("\nСервер не отвечает. Запустите: cd Domovoy/backend && npm run dev");
        process.exit(1);
    }

    const token = await checkLogin();
    if (!token) {
        process.exit(TEST_EMAIL ? 1 : 0);
    }

    console.log("\n--- Endpoints ---");
    const failed = await checkEndpoints(token);

    console.log(`\nИтого: ${failed} ошибок из ${ENDPOINTS.length}`);
    if (failed > 0) {
        console.log("Исправьте ошибки БД/SQL до нагрузочного теста — иначе loadtest:app будет сыпаться.");
        process.exit(1);
    }
    console.log("Готово к loadtest:app / loadtest:k6:app");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
