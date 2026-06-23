import OpenAI from "openai";
import { appealCategoryLabel } from "../constants/appealCategories";

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

const MODERATION_DUTY = `Ты — автоматический фильтр контента в приложении для жителей дома. Текст проверяется ДО публикации.
Твоя задача — классифицировать текст и вернуть JSON. Никогда не отказывайся отвечать и не пиши «я не могу обсуждать» — даже если во входе мат или оскорбления: отметь их в JSON (найдено: true) и предложи нейтральную замену.

`;

const APPEAL_CATEGORIES_DICT = `Аварийная ситуация — прорыв трубы, потоп, отключение воды/тепла/света во всём доме, угроза безопасности, срочное реагирование.
Сантехника — трубы, краны, смесители, унитаз, смыв, бачок, протечки, засоры, канализация, вода.
Электрика — проводка, розетки, выключатели, освещение, лампочки, щиток, отсутствие электричества (не аварийное).
Отопление — батареи, радиаторы, тепло в квартире, температура, стояки отопления.
Вентиляция — вытяжка, вентиляционные каналы, проветривание, запахи из вентиляции.
Уборка и благоустройство — уборка подъездов и территории, мусор, газоны, лавочки, детские площадки, снег, наледь, лифты и оборудование общего пользования.
Нарушение порядка — шум, конфликты между жильцами, нарушение правил проживания, порча имущества, парковка.
Другое — всё, что не относится ни к одной категории выше.`;

const CONTENT_MODERATION_RULES = `Задача 1 — нежелательное содержание.
Проверь все указанные поля. Помечай ТОЛЬКО:
- нецензурную лексику и мат (в т.ч. с опечатками, звёздочками, заменой букв);
- грубые ругательства в адрес человека: «дурак», «идиот», «дебил», «козёл», «урод», «свинья», «мудак» и близкие по грубости;
- унизительные насмешки («пухлый индюк», «бестолочь», «тупой»);
- угрозы.

НЕ помечай — это допустимая жалоба, а не нарушение:
- негативную оценку работы и сервиса: «плохой», «ужасный», «некачественно», «медленно», «не работает», «никто не реагирует»;
- моральную критику без мата: «негодяй», «негодяи», «подлец», «хам», «хамство», «безответственный», «безобразие», «возмутительно»;
- описание конфликта и нарушений без грубых ругательств из списка «помечай».
Сомневаешься — ставь найдено: false.

Для найденного фрагмента предложи нейтральную замену — только для проблемного слова или короткой фразы (1–3 слова), не переписывай всё поле целиком.
фрагмент — только проблемное слово или короткая фраза, не весь текст «Темы» или «Описания».
замена — только замена этого фрагмента, не копия текста из другого поля и не весь заголовок/описание.
поле — строго «тема» или «описание»: где реально стоит фрагмент. Если «Тема» и «Описание» совпадают или описание повторяет тему — укажи «тема».
Если проблем несколько — верни только одну, самую серьёзную. Не указывай тип нарушения (мат, оскорбление и т.п.).`;

const APPEAL_SYSTEM_PROMPT = MODERATION_DUTY + `Ты — ассистент модерации обращений. Каждое обращение состоит из трёх полей:

Категория — раздел, выбранный пользователем из списка: Аварийная ситуация, Сантехника, Электрика, Отопление, Вентиляция, Уборка и благоустройство, Нарушение порядка, Другое.
Тема — короткий заголовок обращения.
Описание — подробный текст проблемы.

Вход:
Категория: {КАТЕГОРИЯ}
Тема: {ТЕМА}
Описание: {ОПИСАНИЕ}

Справочник категорий:

${APPEAL_CATEGORIES_DICT}

${CONTENT_MODERATION_RULES}

Задача 2 — соответствие категории.
Определи по смыслу темы и описания, к какой категории из справочника относится обращение, и сравни с выбранной «{КАТЕГОРИЯ}». Ориентируйся прежде всего на суть описания. Если реальная тема не совпадает с выбранной — ставь категория_совпадает: false и укажи правильную категорию. Если выбрана «Другое» — категория_совпадает: true всегда, тему не переназначай.

Формат ответа. Отвечай строго в формате JSON, без пояснений и текста вне JSON:

{
  "найдено": true,
  "поле": "тема",
  "фрагмент": "<проблемное слово или выражение>",
  "замена": "<нейтральная замена>",
  "категория_совпадает": false,
  "комментарий_категории": "Обращение относится к категории «Сантехника», а не «Отопление»"
}

Если нарушений нет и категория совпадает:

{
  "найдено": false,
  "поле": "",
  "фрагмент": "",
  "замена": "",
  "категория_совпадает": true,
  "комментарий_категории": ""
}

Правила. Оценивай смысл фразы целиком. Негативную оценку и критику не помечай. Если суть обращения не относится к выбранной категории — ставь false. Для категории «Другое» всегда true. Поле «поле» — одно из: тема, описание. Не добавляй ничего вне JSON.`;

const AD_CATEGORIES_DICT = `Продаю — пользователь продаёт, отдаёт или предлагает взять вещь, мебель, технику, одежду и т.п.
Ищу — пользователь хочет купить, взять, найти вещь, человека, помощь, попутчика и т.п.
Услуга — пользователь предлагает услугу: ремонт, репетиторство, уход за животными, перевозки и т.п.
Приглашаю — приглашение на событие, встречу, в группу, совместное занятие.
Потеряно — у пользователя потерялась вещь, документ или животное.
Найдено — пользователь нашёл вещь, документ или животное и ищет владельца.
Другое — всё, что не относится ни к одной категории выше.`;

const AD_SYSTEM_PROMPT = MODERATION_DUTY + `Ты — ассистент модерации объявлений в приложении для жителей многоквартирных домов. Каждое объявление состоит из трёх полей:

Категория — раздел, выбранный пользователем из списка: Продаю, Ищу, Услуга, Приглашаю, Потеряно, Найдено, Другое.
Тема — короткий заголовок объявления.
Описание — подробный текст объявления.

Вход:
Категория: {КАТЕГОРИЯ}
Тема: {ТЕМА}
Описание: {ОПИСАНИЕ}

Справочник категорий:

${AD_CATEGORIES_DICT}

${CONTENT_MODERATION_RULES}

Задача 2 — соответствие категории.
Определи по смыслу темы и описания, к какой категории из справочника относится объявление, и сравни с выбранной «{КАТЕГОРИЯ}». Ориентируйся прежде всего на суть описания. Если реальная тема не совпадает с выбранной — ставь категория_совпадает: false и укажи правильную категорию (из списка: Продаю, Ищу, Услуга, Приглашаю, Потеряно, Найдено, Другое). Если выбрана «Другое» — категория_совпадает: true всегда, категорию не переназначай.

Формат ответа. Отвечай строго в формате JSON, без пояснений и текста вне JSON:

{
  "найдено": true,
  "поле": "тема",
  "фрагмент": "<проблемное слово или выражение>",
  "замена": "<нейтральная замена>",
  "категория_совпадает": false,
  "комментарий_категории": "Объявление относится к категории «Ищу», а не «Продаю»"
}

Если нарушений нет и категория совпадает:

{
  "найдено": false,
  "поле": "",
  "фрагмент": "",
  "замена": "",
  "категория_совпадает": true,
  "комментарий_категории": ""
}

Правила. Оценивай смысл фразы целиком. Негативную оценку и критику не помечай. Если суть объявления не относится к выбранной категории — ставь false. Для категории «Другое» всегда true. Поле «поле» — одно из: тема, описание. Не добавляй ничего вне JSON.`;

const GENERIC_SYSTEM_PROMPT = MODERATION_DUTY + `Ты — ассистент модерации. На вход поступают поля «Тема», «Описание» и, при наличии, «Варианты ответа» (от 2 до 4).

Вход:
Тема: {ТЕМА}
Описание: {ОПИСАНИЕ}
Вариант 1: {ВАРИАНТ_1}
Вариант 2: {ВАРИАНТ_2}
Вариант 3: {ВАРИАНТ_3}
Вариант 4: {ВАРИАНТ_4}

Пустые или незаполненные варианты не проверяй и не отмечай.

${CONTENT_MODERATION_RULES}

Формат ответа. Отвечай строго в формате JSON, без пояснений и текста вне JSON:

{
  "найдено": true,
  "поле": "тема",
  "фрагмент": "<проблемное слово или выражение>",
  "замена": "<нейтральная замена>"
}

Если нарушений нет:

{
  "найдено": false,
  "поле": "",
  "фрагмент": "",
  "замена": ""
}

Поле «поле» — одно из: тема, описание, вариант 1, вариант 2, вариант 3, вариант 4.

Правила. Оценивай смысл фразы целиком. Негативную оценку и критику не помечай. Не добавляй ничего вне JSON.`;

export type ModerationResult =
    | { ok: true }
    | { ok: false; field: string; issue: string; suggestion: string };

type ModerationResponse = {
    найдено: boolean;
    поле?: string;
    фрагмент?: string;
    замена?: string;
    категория_совпадает?: boolean;
    комментарий_категории?: string;
    // legacy: старый формат с массивом проблем
    проблемы?: { фрагмент?: string; замена?: string; источник?: string; тип?: string }[];
};

const FIELD_LABELS: Record<string, string> = {
    title:    "теме",
    body:     "описании",
    category: "категории",
    option1:  "варианте 1",
    option2:  "варианте 2",
    option3:  "варианте 3",
    option4:  "варианте 4",
};

function normalizeFieldText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapModelFieldName(raw: string): string | null {
    const s = raw.trim().toLowerCase();
    if (s === "тема") return "title";
    if (s === "описание") return "body";
    if (s === "категория") return "category";
    const m = s.match(/вариант\s*(\d)/);
    if (m) return `option${m[1]}`;
    return null;
}

function resolveViolationField(
    modelField: string | undefined,
    fragment: string,
    entries: { key: string; text: string }[],
): string {
    const title = entries.find((e) => e.key === "title");
    const body  = entries.find((e) => e.key === "body");
    if (title && body && normalizeFieldText(title.text) === normalizeFieldText(body.text)) {
        return "title";
    }
    if (body && title && body.text.includes(title.text) && normalizeFieldText(body.text) !== normalizeFieldText(title.text)) {
        // Описание начинается с темы — нарушение в теме, если фрагмент есть и там
        const frag = fragment.toLowerCase();
        if (title.text.toLowerCase().includes(frag) && !body.text.toLowerCase().slice(title.text.length).includes(frag)) {
            return "title";
        }
    }

    const mapped = modelField ? mapModelFieldName(modelField) : null;
    const frag   = fragment.toLowerCase();
    const hits   = entries.filter((e) => e.text.toLowerCase().includes(frag));

    if (mapped && hits.some((h) => h.key === mapped)) return mapped;
    if (mapped === "title" || mapped === "body" || mapped?.startsWith("option")) return mapped;

    if (hits.length === 1) return hits[0].key;
    if (hits.length > 1) return "title";

    return mapped ?? entries[0]?.key ?? "title";
}

function mapModelField(raw?: string, fallbackText?: string, entries?: { key: string; text: string }[]): string {
    if (fallbackText && entries?.length) {
        return resolveViolationField(raw, fallbackText, entries);
    }
    return raw ? (mapModelFieldName(raw) ?? entries?.[0]?.key ?? "title") : (entries?.[0]?.key ?? "title");
}

function contentViolation(field: string, fragment: string, replacement: string): ModerationResult {
    const where = FIELD_LABELS[field] ?? "тексте";
    return {
        ok: false,
        field,
        issue: `В ${where} недопустимо: «${fragment}»`,
        suggestion: replacement,
    };
}

function pickContentProblem(parsed: ModerationResponse, entries?: { key: string; text: string }[]): ModerationResult | null {
    if (parsed.найдено && parsed.фрагмент?.trim() && parsed.замена?.trim()) {
        const field = mapModelField(parsed.поле, parsed.фрагмент, entries);
        return contentViolation(field, parsed.фрагмент.trim(), parsed.замена.trim());
    }

    const legacy = parsed.проблемы?.find((p) => p.фрагмент?.trim() && p.замена?.trim());
    if (parsed.найдено && legacy?.фрагмент && legacy.замена) {
        const field = legacy.источник
            ? mapModelField(legacy.источник, legacy.фрагмент, entries)
            : mapModelField(undefined, legacy.фрагмент, entries);
        return contentViolation(field, legacy.фрагмент.trim(), legacy.замена.trim());
    }

    return null;
}

const MODEL_APPEAL = () => process.env.YANDEX_MODEL_APPEAL
    ?? `gpt://${process.env.YANDEX_PROJECT_ID}/yandexgpt-5-lite/latest`;

const MODEL_AD = () => process.env.YANDEX_MODEL_AD
    ?? `gpt://${process.env.YANDEX_PROJECT_ID}/yandexgpt-5-lite/latest`;

const MODEL_GENERIC = () => process.env.YANDEX_MODEL_GENERIC
    ?? `gpt://${process.env.YANDEX_PROJECT_ID}/yandexgpt-5-lite/latest`;

const JSON_RETRY_HINT = "\n\nВАЖНО: ответ — только один JSON-объект. Без markdown, без ``` и без текста до или после JSON.";

const MODERATION_STRICT_RETRY = `

ОБЯЗАТЕЛЬНО: это служебная модерация. Не отказывайся. Даже при мате или оскорблениях во входе — верни JSON с найдено:true, фрагментом и нейтральной заменой.`;

class ModelRefusalError extends Error {
    constructor(public readonly raw: string) {
        super("model refusal");
        this.name = "ModelRefusalError";
    }
}

function isModelRefusal(raw: string): boolean {
    const s = raw.trim().toLowerCase();
    return s.startsWith("я не могу")
        || s.includes("не могу обсуждать")
        || s.includes("давайте поговорим о чём")
        || s.includes("i can't")
        || s.includes("cannot discuss");
}

function refusalViolation(title: string, body: string, options: string[] = []): ModerationResult {
    const entries = [
        { key: "title", text: title },
        { key: "body",  text: body },
        ...options.map((text, i) => ({ key: `option${i + 1}`, text })),
    ].filter((e) => e.text);
    const field = entries[0]?.key ?? "title";
    const where = FIELD_LABELS[field] ?? "тексте";
    return {
        ok: false,
        field,
        issue: `В ${where} недопустимые выражения. Уберите грубость и оскорбления.`,
        suggestion: "нейтральная формулировка",
    };
}

function stripCodeFences(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) return fenced[1].trim();
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractJson<T>(raw: string): T {
    const text = stripCodeFences(raw);
    try {
        return JSON.parse(text) as T;
    } catch {
        const start = text.indexOf("{");
        if (start < 0) throw new Error(`JSON not found: ${text.slice(0, 120)}`);

        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
                if (escape) escape = false;
                else if (ch === "\\") escape = true;
                else if (ch === '"') inString = false;
                continue;
            }
            if (ch === '"') { inString = true; continue; }
            if (ch === "{") depth++;
            else if (ch === "}") {
                depth--;
                if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T;
            }
        }
        throw new Error(`Invalid JSON: ${text.slice(0, 160)}`);
    }
}

async function callModel(model: string, systemPrompt: string, userMessage: string): Promise<string> {
    const client = getClient();
    if (!client) throw new Error("no client");

    const response = await client.chat.completions.create({
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userMessage },
        ],
        temperature: 0,
    });

    return (response.choices[0]?.message?.content ?? "").trim();
}

async function callModelJson<T>(model: string, systemPrompt: string, userMessage: string): Promise<T> {
    const parse = (raw: string): T => {
        if (isModelRefusal(raw)) throw new ModelRefusalError(raw);
        return extractJson<T>(raw);
    };

    let raw = await callModel(model, systemPrompt, userMessage);
    try {
        return parse(raw);
    } catch (firstErr) {
        const strictRetry = systemPrompt + MODERATION_STRICT_RETRY + JSON_RETRY_HINT;
        const jsonRetry   = systemPrompt + JSON_RETRY_HINT;

        if (firstErr instanceof ModelRefusalError) {
            console.warn("[moderation] model refusal, strict retry");
            raw = await callModel(model, strictRetry, userMessage);
            try {
                return parse(raw);
            } catch (secondErr) {
                if (secondErr instanceof ModelRefusalError) throw secondErr;
                throw firstErr;
            }
        }

        console.warn("[moderation] JSON parse failed, retry. Raw:", raw.slice(0, 300));
        raw = await callModel(model, jsonRetry, userMessage);
        try {
            return parse(raw);
        } catch (secondErr) {
            if (secondErr instanceof ModelRefusalError) throw secondErr;
            console.error("[moderation] JSON parse failed after retry. Raw:", raw.slice(0, 500));
            throw firstErr;
        }
    }
}

async function moderateCategorized(
    model: string,
    systemPromptTemplate: string,
    defaultIssue: string,
    fields: { title: string; body: string; category?: string; categoryLabel?: string },
): Promise<ModerationResult> {
    const categoryLabel = fields.categoryLabel
        ?? (fields.category ? appealCategoryLabel(fields.category) : "");
    const systemPrompt = systemPromptTemplate.replace(/\{КАТЕГОРИЯ\}/g, categoryLabel);
    const userMessage = `Категория: ${categoryLabel}\nТема: ${fields.title}\nОписание: ${fields.body}`;

    const parsed = await callModelJson<ModerationResponse>(model, systemPrompt, userMessage);

    const entries = [
        { key: "title", text: fields.title },
        { key: "body",  text: fields.body },
    ].filter((e) => e.text);

    const content = pickContentProblem(parsed, entries);
    if (content) return content;

    if (parsed.категория_совпадает === false) {
        return {
            ok: false,
            field:      "category",
            issue:      parsed.комментарий_категории || defaultIssue,
            suggestion: parsed.комментарий_категории || "Выберите подходящую категорию",
        };
    }

    return { ok: true };
}

async function moderateGeneric(fields: {
    title: string;
    body: string;
    options?: string[];
}): Promise<ModerationResult> {
    const options = (fields.options ?? []).map((o) => o.trim());

    const userMessage = [
        `Тема: ${fields.title}`,
        `Описание: ${fields.body}`,
        `Вариант 1: ${options[0] ?? ""}`,
        `Вариант 2: ${options[1] ?? ""}`,
        `Вариант 3: ${options[2] ?? ""}`,
        `Вариант 4: ${options[3] ?? ""}`,
    ].join("\n");

    const parsed = await callModelJson<ModerationResponse>(MODEL_GENERIC(), GENERIC_SYSTEM_PROMPT, userMessage);

    const entries = [
        { key: "title", text: fields.title },
        { key: "body",  text: fields.body },
        ...options.map((text, i) => ({ key: `option${i + 1}`, text })),
    ].filter((e) => e.text);

    const content = pickContentProblem(parsed, entries);
    if (content) return content;

    return { ok: true };
}

export function isModerationEnabled(): boolean {
    return Boolean(process.env.YANDEX_API_KEY);
}

export async function moderateContent(
    kind: "appeal" | "vote" | "ad",
    fields: {
        title?: string;
        body?: string;
        topic?: string;
        description?: string;
        category?: string;
        categoryLabel?: string;
        options?: string[];
    },
): Promise<ModerationResult> {
    const client = getClient();
    if (!client) {
        console.warn("[moderation] YANDEX_API_KEY не задан — проверка отключена");
        return { ok: true };
    }

    const title = fields.title ?? fields.topic ?? "";
    const body  = fields.body  ?? fields.description ?? "";
    const options = (fields.options ?? []).map((o) => o.trim());
    if (!title && !body && !options.some(Boolean)) return { ok: true };

    try {
        if (kind === "appeal") {
            return await moderateCategorized(
                MODEL_APPEAL(), APPEAL_SYSTEM_PROMPT,
                "Тема обращения не соответствует выбранной категории",
                { title, body, category: fields.category },
            );
        }
        if (kind === "ad") {
            return await moderateCategorized(
                MODEL_AD(), AD_SYSTEM_PROMPT,
                "Тема объявления не соответствует выбранной категории",
                { title, body, categoryLabel: fields.categoryLabel ?? fields.category },
            );
        }
        return await moderateGeneric({ title, body, options });
    } catch (err) {
        if (err instanceof ModelRefusalError) {
            console.warn("[moderation] model refused — treating as violation");
            return refusalViolation(title, body, options);
        }
        console.error("[moderation]", err);
        return {
            ok: false,
            field: "title",
            issue: "Не удалось проверить текст. Попробуйте ещё раз через минуту.",
            suggestion: "",
        };
    }
}
