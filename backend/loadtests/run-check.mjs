/**
 * Полная проверка перед релизом: diagnose → smoke → load.
 *
 *   $env:BASE_URL = "http://127.0.0.1:3001"
 *   $env:TEST_EMAIL = "..."
 *   $env:TEST_PASSWORD = "..."
 *   npm run loadtest:check
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3001";

function run(step, label, args, extraEnv = {}) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  ${step} — ${label}`);
    console.log(`${"=".repeat(50)}\n`);

    const result = spawnSync(process.execPath, args, {
        stdio: "inherit",
        cwd: root,
        env: { ...process.env, BASE_URL, ...extraEnv },
    });

    if (result.status !== 0) {
        console.error(`\n✗ Шаг «${label}» не прошёл (код ${result.status ?? 1})`);
        process.exit(result.status ?? 1);
    }
}

if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
    console.error("Задайте TEST_EMAIL и TEST_PASSWORD (тестовый пользователь из users).");
    console.error("Пример:");
    console.error('  $env:TEST_EMAIL = "you@test.com"');
    console.error('  $env:TEST_PASSWORD = "secret"');
    process.exit(1);
}

console.log(`Полная проверка API: ${BASE_URL}`);
console.log(`Пользователь: ${process.env.TEST_EMAIL}`);

run("1/3", "Диагностика (health, login, 17 endpoint'ов)", ["loadtests/diagnose.mjs"]);
run("2/3", "Smoke — 5 пользователей, 30 сек (/health)", ["loadtests/run-k6.mjs", "loadtests/smoke.js"], {
    VUS: "5",
    DURATION: "30s",
});
run("3/3", "Load — 30 пользователей, ~5 мин (открытие приложения)", [
    "loadtests/run-k6.mjs",
    "loadtests/app-startup.js",
], {
    LOAD_PROFILE: "load",
});

console.log("\n✓ Полная проверка пройдена");
