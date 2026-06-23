/**
 * Проверка готовности к нагрузочным тестам: health, login, profile, GET endpoint'ы, создание + удаление.
 *
 *   set TEST_EMAIL=...
 *   set TEST_PASSWORD=...
 *   node loadtests/diagnose.mjs
 */
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const CHECK_WRITES = process.env.CHECK_WRITES !== "0";

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
    return { token: data.accessToken, profile: data.profile };
}

function checkProfile(profile) {
    if (!profile) {
        console.log("✗ profile отсутствует в ответе login");
        return false;
    }
    const hasBuilding = Boolean(profile.building || profile.buildingName || profile.buildingKey);
    const hasApartment = Boolean(profile.apartment || profile.apartmentId);
    const ok = hasBuilding && hasApartment;
    console.log(
        ok
            ? `✓ profile OK (${profile.buildingName || profile.building || "дом"}, кв. ${profile.apartment})`
            : "✗ profile неполный — нет привязки к дому/квартире",
    );
    return ok;
}

async function request(method, path, token, body) {
    const started = performance.now();
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const ms = (performance.now() - started).toFixed(0);
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    return { res, ms, json, text };
}

function logResult(mark, label, status, ms, snippet = "") {
    console.log(`${mark} ${label} ${status} (${ms} ms)${snippet ? ` ${snippet}` : ""}`);
}

async function checkEndpoints(token) {
    let failed = 0;

    for (const path of ENDPOINTS) {
        try {
            const { res, ms, text } = await request("GET", path, token);
            const snippet = res.status >= 400 ? text.slice(0, 120) : "";
            const mark = res.ok ? "✓" : "✗";
            logResult(mark, path, res.status, ms, snippet);
            if (!res.ok) failed += 1;
        } catch (err) {
            console.log(`✗ ${path} ERROR ${err instanceof Error ? err.message : err}`);
            failed += 1;
        }
    }

    return failed;
}

async function checkCreates(token) {
    const tag = `[loadtest-${Date.now()}]`;
    let failed = 0;

    async function createAndDelete(label, createPath, createBody, idFromJson) {
        try {
            const created = await request("POST", createPath, token, createBody);
            const mark = created.res.status === 201 ? "✓" : "✗";
            logResult(mark, `POST ${createPath}`, created.res.status, created.ms, created.res.status >= 400 ? created.text.slice(0, 120) : "");

            if (created.res.status !== 201) {
                failed += 1;
                return;
            }

            const id = idFromJson(created.json);
            if (!id) {
                console.log(`✗ POST ${createPath} — нет id в ответе`);
                failed += 1;
                return;
            }

            const deleted = await request("DELETE", `${createPath}/${id}`, token);
            const delMark = deleted.res.ok || deleted.res.status === 204 ? "✓" : "✗";
            logResult(delMark, `DELETE ${createPath}/${id}`, deleted.res.status, deleted.ms);
            if (!deleted.res.ok && deleted.res.status !== 204) failed += 1;
        } catch (err) {
            console.log(`✗ ${label} ERROR ${err instanceof Error ? err.message : err}`);
            failed += 1;
        }
    }

    await createAndDelete(
        "neighbor-ad",
        "/api/neighbor-ads",
        { title: `${tag} объявление`, body: "Тест диагностики", category: "other" },
        (json) => json?.id,
    );

    await createAndDelete(
        "appeal",
        "/api/appeals",
        {
            title: `${tag} обращение`,
            body: "Тест диагностики обращения",
            category: "plumbing",
            kind: "personal",
        },
        (json) => json?.id,
    );

    await createAndDelete(
        "vote",
        "/api/votes",
        {
            topic: `${tag} голосование`,
            description: "Тест диагностики голосования",
            visibility: "open",
            optionLabels: ["Да", "Нет"],
            durationDays: 3,
        },
        (json) => json?.id,
    );

    return failed;
}

async function main() {
    console.log(`Target: ${BASE_URL}\n`);

    const healthOk = await checkHealth();
    if (!healthOk) {
        console.log("\nСервер не отвечает. Запустите: cd Domovoy/backend && npm run dev");
        process.exit(1);
    }

    const session = await checkLogin();
    if (!session) {
        process.exit(TEST_EMAIL ? 1 : 0);
    }

    let failed = 0;

    console.log("\n--- Profile ---");
    if (!checkProfile(session.profile)) failed += 1;

    console.log("\n--- Endpoints ---");
    failed += await checkEndpoints(session.token);

    if (CHECK_WRITES) {
        console.log("\n--- Create / delete ---");
        failed += await checkCreates(session.token);
    }

    const writeNote = CHECK_WRITES ? " + 3 create/delete" : "";
    console.log(`\nИтого: ${failed} ошибок`);
    if (failed > 0) {
        console.log("Исправьте ошибки до нагрузочного теста — иначе loadtest:app будет сыпаться.");
        process.exit(1);
    }
    console.log(`Готово к loadtest:app / loadtest:k6:app${writeNote}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
