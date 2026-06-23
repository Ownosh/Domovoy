/**
 * Запуск k6 с поиском бинарника (Windows: часто не в PATH после winget).
 * Usage: node loadtests/run-k6.mjs loadtests/smoke.js
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const script = process.argv[2];
const loadProfile = process.argv[3];
if (!script) {
    console.error("Usage: node loadtests/run-k6.mjs <script.js> [load|peak|quick]");
    process.exit(1);
}

const candidates = [
    process.env.K6_BIN,
    "k6",
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "k6", "k6.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", "k6.exe"),
].filter(Boolean);

let k6Bin = null;
for (const candidate of candidates) {
    if (candidate === "k6") {
        const probe = spawnSync(candidate, ["version"], { shell: true, stdio: "ignore" });
        if (probe.status === 0) {
            k6Bin = candidate;
            break;
        }
        continue;
    }
    if (fs.existsSync(candidate)) {
        k6Bin = candidate;
        break;
    }
}

if (!k6Bin) {
    console.error(
        "k6 не найден. Установите: winget install GrafanaLabs.k6\n" +
            "Или задайте K6_BIN=C:\\Program Files\\k6\\k6.exe",
    );
    process.exit(1);
}

const result = spawnSync(k6Bin, ["run", script, ...process.argv.slice(4)], {
    stdio: "inherit",
    shell: k6Bin === "k6",
    env: {
        ...process.env,
        BASE_URL: process.env.BASE_URL || "http://127.0.0.1:3001",
        ...(loadProfile ? { LOAD_PROFILE: loadProfile } : {}),
    },
});

process.exit(result.status ?? 1);
