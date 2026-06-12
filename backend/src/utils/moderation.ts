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

export const APPEAL_CATEGORIES_LIST = "Аварийная ситуация, Сантехника, Электрика, Отопление, Вентиляция, Уборка и благоустройство, Нарушение порядка, Другое";

export const APPEAL_CATEGORIES_DICT = `Аварийная ситуация — прорыв трубы, потоп, отключение воды/тепла/света во всём доме, угроза безопасности, срочное реагирование.
Сантехника — трубы, краны, смесители, унитаз, смыв, бачок, протечки, засоры, канализация, вода.
Электрика — проводка, розетки, выключатели, освещение, лампочки, щиток, отсутствие электричества (не аварийное).
Отопление — батареи, радиаторы, тепло в квартире, температура, стояки отопления.
Вентиляция — вытяжка, вентиляционные каналы, проветривание, запахи из вентиляции.
Уборка и благоустройство — уборка подъездов и территории, мусор, газоны, лавочки, детские площадки, снег, наледь, лифты и оборудование общего пользования.
Нарушение порядка — шум, конфликты между жильцами, нарушение правил проживания, порча имущества, парковка.
Другое — всё, что не относится ни к одной категории выше.`;

export const AD_CATEGORIES_LIST = "Продаю, Ищу, Услуга, Приглашаю, Потеряно, Найдено, Другое";

export const AD_CATEGORIES_DICT = `Продаю — пользователь продаёт, отдаёт или предлагает взять вещь, мебель, технику, одежду и т.п.
Ищу — пользователь хочет купить, взять, найти вещь, человека, помощь, попутчика и т.п.
Услуга — пользователь предлагает услугу: ремонт, репетиторство, уход за животными, перевозки и т.п.
Приглашаю — приглашение на событие, встречу, в группу, совместное занятие.
Потеряно — у пользователя потерялась вещь, документ или животное.
Найдено — пользователь нашёл вещь, документ или животное и ищет владельца.
Другое — всё, что не относится ни к одной категории выше.`;

const BASE_PROMPT = `Ты — ассистент модерации пользовательского контента в приложении для жителей многоквартирных домов. Тебе передаются поля «Тема» (короткий заголовок), «Описание» (основной текст) и, опционально, «Варианты ответов» (для голосований).

Вход:
Тема: {ТЕМА}
Описание: {ОПИСАНИЕ}
{ВАРИАНТЫ}

Задача 1 — нежелательное содержание.
Проверь «Тему», «Описание» и «Варианты ответов» (если есть). Анализируй слова и выражения целиком. Помечай:

нецензурную лексику и мат (в т.ч. с опечатками, звёздочками, заменой букв);
оскорбления и унижающие выражения, даже без мата (например: «пухлый индюк», «бестолочь»);
грубость, переход на личности, угрозы.

Для каждого фрагмента предложи корректную замену.
Что НЕ помечать: обычную негативную оценку и критику. Слова «плохой», «ужасный», «некачественно», «медленно», «не работает», «никто не реагирует» — это законная жалоба или мнение, а не нарушение. Сомневаешься между нарушением и резкой критикой — НЕ помечай.

Задача 2 — орфография.
Найди слова с явными опечатками и ошибками, которые мешают понять смысл или выглядят как набор букв (например: «лиргв» вместо «лифт»). Проверяй все переданные поля, включая варианты ответов. Для каждого предложи правильное написание. Не придирайся к регистру, пунктуации и мелким стилистическим неточностям — отмечай только заметные ошибки в словах.`;

const CATEGORY_TASK = `

Задача 3 — соответствие категории.
Категория — раздел, выбранный пользователем из списка: {КАТЕГОРИИ}.
Справочник категорий:

{СПРАВОЧНИК}

Вход дополнительно содержит:
Категория: {КАТЕГОРИЯ}

Определи по смыслу темы и описания, к какой категории из справочника относится текст, и сравни с выбранной «{КАТЕГОРИЯ}». Ориентируйся прежде всего на суть описания. Если реальная тема не совпадает с выбранной — ставь категория_совпадает: false и укажи правильную категорию в комментарии. Если выбрана «Другое» — категория_совпадает: true всегда, категорию не переназначай.`;

const FORMAT_WITH_CATEGORY = `

Формат ответа. Отвечай строго в формате JSON, без пояснений и текста вне JSON:
{"найдено": true, "проблемы": [{"фрагмент": "<слово или выражение>", "тип": "<оскорбление / мат / грубость / угроза>", "замена": "<корректная формулировка>"}], "опечатки": [{"слово": "<как написано>", "правильно": "<правильное написание>"}], "категория_совпадает": false, "комментарий_категории": "Текст относится к категории «Сантехника», а не «Отопление»"}
Если нарушений и опечаток нет и категория совпадает:
{"найдено": false, "проблемы": [], "опечатки": [], "категория_совпадает": true, "комментарий_категории": ""}

Правила. Оценивай смысл фразы целиком. Негативную оценку и критику не помечай. В опечатках отмечай только заметные ошибки, а не стиль. Если суть текста не относится к выбранной категории — ставь false. Для категории «Другое» всегда true. Не добавляй ничего вне JSON.`;

const FORMAT_WITHOUT_CATEGORY = `

Формат ответа. Отвечай строго в формате JSON, без пояснений и текста вне JSON:
{"найдено": true, "проблемы": [{"фрагмент": "<слово или выражение>", "тип": "<оскорбление / мат / грубость / угроза>", "замена": "<корректная формулировка>"}], "опечатки": [{"слово": "<как написано>", "правильно": "<правильное написание>"}]}
Если нарушений и опечаток нет:
{"найдено": false, "проблемы": [], "опечатки": []}

Правила. Оценивай смысл фразы целиком. Негативную оценку и критику не помечай. В опечатках отмечай только заметные ошибки, а не стиль. Не добавляй ничего вне JSON.`;

export type TypoCorrection = { word: string; correct: string };

export type ModerationResult =
    | { ok: true }
    | { ok: false; field: string; issue: string; suggestion: string };

type ModerationProblem = {
    фрагмент: string;
    тип: "оскорбление" | "мат" | "грубость" | "угроза";
    замена: string;
};

type TypoRaw = {
    слово: string;
    правильно: string;
};

type ModerationResponse = {
    найдено: boolean;
    проблемы: ModerationProblem[];
    опечатки: TypoRaw[];
    категория_совпадает?: boolean;
    комментарий_категории?: string;
};

const TYPE_LABELS: Record<ModerationProblem["тип"], string> = {
    мат:         "нецензурная лексика",
    оскорбление: "оскорбление",
    грубость:    "грубость",
    угроза:      "угроза",
};

export type CategoryOptions = {
    /** Текущая категория, выбранная пользователем */
    current: string;
    /** Список допустимых категорий через запятую */
    list: string;
    /** Справочник категорий с описаниями (по одной на строку: "Название — описание") */
    dict: string;
};

export async function moderateContent(
    fields: {
        title?: string;
        body?: string;
        topic?: string;
        description?: string;
        options?: string[];
    },
    categories?: CategoryOptions,
): Promise<ModerationResult> {
    const client = getClient();
    if (!client) return { ok: true };

    const topic       = fields.title ?? fields.topic ?? "";
    const description = fields.body  ?? fields.description ?? "";
    const options     = (fields.options ?? []).filter((o) => o.trim());
    if (!topic && !description && !options.length) return { ok: true };

    const model = process.env.YANDEX_MODEL
        ?? `gpt://${process.env.YANDEX_PROJECT_ID}/yandexgpt/latest`;

    const optionsBlock = options.length
        ? `Варианты ответов:\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
        : "";

    const systemPrompt = (categories
        ? BASE_PROMPT
            + CATEGORY_TASK
                .replace("{КАТЕГОРИИ}", categories.list)
                .replace("{СПРАВОЧНИК}", categories.dict)
                .replace(/\{КАТЕГОРИЯ\}/g, categories.current)
            + FORMAT_WITH_CATEGORY
        : BASE_PROMPT + FORMAT_WITHOUT_CATEGORY
    ).replace("{ВАРИАНТЫ}", optionsBlock);

    const userMessage = (categories ? `Категория: ${categories.current}\n` : "")
        + `Тема: ${topic}\nОписание: ${description}`
        + (optionsBlock ? `\n${optionsBlock}` : "");

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user",   content: userMessage },
            ],
            temperature: 0,
        });

        const raw   = (response.choices[0]?.message?.content ?? "").trim();
        const match = raw.match(/\{[\s\S]*\}/);
        const parsed: ModerationResponse = JSON.parse(match ? match[0] : raw);

        const typos: TypoCorrection[] = (parsed.опечатки ?? []).map((t) => ({
            word:    t.слово,
            correct: t.правильно,
        }));

        const entries = [
            { key: "title",       text: fields.title       ?? "" },
            { key: "body",        text: fields.body        ?? "" },
            { key: "topic",       text: fields.topic       ?? "" },
            { key: "description", text: fields.description ?? "" },
        ].filter((e) => e.text);

        const fieldFor = (fragment: string): string => {
            let field = entries[0]?.key ?? "title";
            for (const entry of entries) {
                if (entry.text.toLowerCase().includes(fragment.toLowerCase())) {
                    field = entry.key;
                    break;
                }
            }
            return field;
        };

        // Приоритет 1 — нежелательное содержание
        if (parsed.найдено && parsed.проблемы?.length) {
            const field = fieldFor(parsed.проблемы[0].фрагмент);

            const issueList    = parsed.проблемы.map((p) => `«${p.фрагмент}» (${TYPE_LABELS[p.тип] ?? p.тип})`).join(", ");
            const replacements = parsed.проблемы.map((p) => `«${p.фрагмент}» → «${p.замена}»`).join("; ");

            return { ok: false, field, issue: `Обнаружено нежелательное содержание: ${issueList}`, suggestion: replacements };
        }

        // Приоритет 2 — несоответствие категории
        if (categories && parsed.категория_совпадает === false) {
            return {
                ok: false,
                field:      "category",
                issue:      parsed.комментарий_категории || "Тема не соответствует выбранной категории",
                suggestion: "Пожалуйста, выберите подходящую категорию",
            };
        }

        // Приоритет 3 — опечатки
        if (typos.length) {
            const field = fieldFor(typos[0].word);
            const replacements = typos.map((t) => `«${t.word}» → «${t.correct}»`).join("; ");

            return { ok: false, field, issue: "Возможные опечатки в тексте", suggestion: replacements };
        }

        return { ok: true };
    } catch (err) {
        console.error("[moderation]", err);
        return { ok: true };
    }
}
