/**
 * Smoke-test: типовые SQL-injection payload'ы на публичные эндпоинты.
 * Запуск: node scripts/sql-injection-smoke.mjs
 * Опции: BASE_URL=http://localhost:3001 TOKEN=eyJ...
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const TOKEN = process.env.TOKEN ?? "";

const PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1--",
    "admin'--",
    "'; DROP TABLE users; --",
    "' UNION SELECT NULL--",
    "1 OR 1=1",
    "1; DROP TABLE users",
    "%' OR '1'='1",
];

const SQL_ERROR_RE =
    /sql syntax|mysql|syntax error|unexpected token|ORA-|SQLite|SQLSTATE|near '/i;

let failed = 0;

function log(kind, msg) {
    const mark = kind === "FAIL" ? "FAIL" : kind === "WARN" ? "WARN" : " OK ";
    console.log(`[${mark}] ${msg}`);
    if (kind === "FAIL") failed++;
}

async function request(method, path, { json, token } = {}) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: json ? JSON.stringify(json) : undefined,
    });
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = text;
    }
    return { status: res.status, body, text };
}

function check(name, res, { denyStatuses = [401, 400, 404], forbidToken = true } = {}) {
    const bodyStr = typeof res.body === "string" ? res.body : JSON.stringify(res.body);

    if (SQL_ERROR_RE.test(bodyStr)) {
        log("FAIL", `${name} — в ответе признаки SQL-ошибки (${res.status})`);
        return;
    }

    if (forbidToken && res.body && typeof res.body === "object" && res.body.accessToken) {
        log("FAIL", `${name} — получен accessToken (${res.status})`);
        return;
    }

    if (!denyStatuses.includes(res.status) && res.status >= 500) {
        log("WARN", `${name} — HTTP ${res.status} (проверьте логи сервера)`);
        return;
    }

    log("OK", `${name} — HTTP ${res.status}`);
}

console.log(`SQL injection smoke test → ${BASE}\n`);

for (const p of PAYLOADS) {
    const res = await request("POST", "/api/auth/login", {
        json: { email: p, password: "x" },
    });
    check(`login email=${JSON.stringify(p)}`, res);
}

for (const p of PAYLOADS) {
    const q = encodeURIComponent(p);
    const res = await request("GET", `/api/buildings/search?q=${q}`);
    check(`buildings/search q=${JSON.stringify(p)}`, res, { forbidToken: false });
}

if (TOKEN) {
    for (const p of PAYLOADS.slice(0, 4)) {
        const q = encodeURIComponent(p);
        const res = await request("GET", `/api/ratings/my?month=${q}`, { token: TOKEN });
        check(`ratings/my month=${JSON.stringify(p)}`, res, { forbidToken: false });
    }
    for (const p of ["1 OR 1=1", "1;DROP TABLE appeals"]) {
        const enc = encodeURIComponent(p);
        const res = await request("GET", `/api/appeals/${enc}`, { token: TOKEN });
        check(`appeals/id=${JSON.stringify(p)}`, res, { forbidToken: false });
    }
} else {
    console.log("\n(TOKEN не задан — пропуск защищённых GET /ratings, /appeals)\n");
}

console.log(`\nГотово: ${failed} подозрительных ответов`);
process.exit(failed > 0 ? 1 : 0);
