import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
    if (!process.env.YANDEX_API_KEY) return null;
    if (!_client) {
        _client = new OpenAI({
            apiKey: process.env.YANDEX_API_KEY,
            baseURL: "https://ai.api.cloud.yandex.net/v1",
            defaultHeaders: {
                "OpenAI-Project": process.env.YANDEX_PROJECT_ID ?? "",
            },
        });
    }
    return _client;
}

export type ModerationResult =
    | { ok: true }
    | { ok: false; field: string; issue: string; suggestion: string };

type ModerationProblem = {
    фрагмент: string;
    тип: "оскорбление" | "мат" | "грубость" | "угроза";
    замена: string;
};

type YandexModerationResponse = {
    найдено: boolean;
    проблемы: ModerationProblem[];
};

const TYPE_LABELS: Record<ModerationProblem["тип"], string> = {
    мат:        "нецензурная лексика",
    оскорбление: "оскорбление",
    грубость:   "грубость",
    угроза:     "угроза",
};

export async function moderateContent(fields: {
    title?: string;
    body?: string;
    topic?: string;
    description?: string;
}): Promise<ModerationResult> {
    const client = getClient();
    if (!client) return { ok: true };

    const entries: Array<{ key: string; text: string }> = [];
    if (fields.title)       entries.push({ key: "title",       text: fields.title });
    if (fields.body)        entries.push({ key: "body",        text: fields.body });
    if (fields.topic)       entries.push({ key: "topic",       text: fields.topic });
    if (fields.description) entries.push({ key: "description", text: fields.description });
    if (!entries.length) return { ok: true };

    const promptId = process.env.YANDEX_PROMPT_ID;
    if (!promptId) return { ok: true };

    const combinedText = entries.map((e) => e.text).join(" ");

    try {
        const response = await (client.responses as any).create({
            prompt: { id: promptId },
            input: combinedText,
        });

        const raw: string = ((response as any).output_text ?? "").trim();
        const match = raw.match(/\{[\s\S]*\}/);
        const parsed: YandexModerationResponse = JSON.parse(match ? match[0] : raw);

        if (!parsed.найдено || !parsed.проблемы?.length) {
            return { ok: true };
        }

        // Определяем поле, в котором найдено первое нарушение
        const first = parsed.проблемы[0];
        let field = entries[0].key;
        for (const entry of entries) {
            if (entry.text.toLowerCase().includes(first.фрагмент.toLowerCase())) {
                field = entry.key;
                break;
            }
        }

        const issueList = parsed.проблемы
            .map((p) => `«${p.фрагмент}» (${TYPE_LABELS[p.тип] ?? p.тип})`)
            .join(", ");

        const replacements = parsed.проблемы
            .map((p) => `«${p.фрагмент}» → «${p.замена}»`)
            .join("; ");

        return {
            ok: false,
            field,
            issue: `Обнаружено нежелательное содержание: ${issueList}`,
            suggestion: replacements,
        };
    } catch (err) {
        console.error("[moderation]", err);
        return { ok: true };
    }
}
