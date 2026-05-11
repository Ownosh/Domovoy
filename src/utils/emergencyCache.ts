import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EmergencyContactLine } from "../types";

const CACHE_KEY = "@domovoy/emergency_lines_cache_v1";

export function mergeEmergencyLines(
    base: EmergencyContactLine[],
    extras: EmergencyContactLine[],
): EmergencyContactLine[] {
    const byId = new Map<string, EmergencyContactLine>();
    for (const b of base) byId.set(b.id, b);
    for (const e of extras) {
        if (!byId.has(e.id)) byId.set(e.id, e);
    }
    return [...byId.values()];
}

/** Порядок показа: единый номер → короткие → коммунальные → УК → остальные по названию */
const LINE_ORDER: readonly string[] = [
    "e112",
    "police",
    "ambulance",
    "gas",
    "plumb",
    "elec",
    "lift",
    "uk_dispatch",
    "uk_lift",
];

function lineOrderIndex(id: string): number {
    const i = LINE_ORDER.indexOf(id);
    return i === -1 ? 9999 : i;
}

export function sortEmergencyLines(
    lines: EmergencyContactLine[],
): EmergencyContactLine[] {
    return [...lines].sort((a, b) => {
        const d = lineOrderIndex(a.id) - lineOrderIndex(b.id);
        if (d !== 0) return d;
        return a.title.localeCompare(b.title, "ru");
    });
}

const SECTION_SPECS: readonly {
    title: string;
    ids: readonly string[];
}[] = [
    { title: "Если не знаете в какую экстренную службу обратиться, звоните 112", ids: ["e112"] },
    { title: "Службы экстренной помощи", ids: ["police", "ambulance", "gas"] },
    { title: "Коммунальные аварийные", ids: ["plumb", "elec", "lift"] },
    { title: "Дом и управляющая компания", ids: ["uk_dispatch", "uk_lift"] },
];

export type EmergencyLineSection = { title: string; lines: EmergencyContactLine[] };

/** Группировка для экрана списка: секции с фиксированным порядком, неизвестные id — в конце */
export function groupEmergencyLinesForDisplay(
    lines: EmergencyContactLine[],
): EmergencyLineSection[] {
    const sorted = sortEmergencyLines(lines);
    const byId = new Map(sorted.map((l) => [l.id, l]));
    const used = new Set<string>();
    const out: EmergencyLineSection[] = [];

    for (const spec of SECTION_SPECS) {
        const chunk: EmergencyContactLine[] = [];
        for (const id of spec.ids) {
            const l = byId.get(id);
            if (l) {
                chunk.push(l);
                used.add(id);
            }
        }
        if (chunk.length > 0) {
            out.push({ title: spec.title, lines: chunk });
        }
    }

    const rest = sorted.filter((l) => !used.has(l.id));
    if (rest.length > 0) {
        out.push({
            title: "Другие номера",
            lines: rest,
        });
    }
    return out;
}

export async function readEmergencyLinesCache(): Promise<
    EmergencyContactLine[] | null
> {
    try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const o = JSON.parse(raw) as unknown;
        if (!Array.isArray(o)) return null;
        return o as EmergencyContactLine[];
    } catch {
        return null;
    }
}

export async function writeEmergencyLinesCache(
    lines: EmergencyContactLine[],
): Promise<void> {
    try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(lines));
    } catch {
        /* offline cache best-effort */
    }
}
