import type {
    Appeal,
    AppNotification,
    ContractorProfile,
    EmergencyContactLine,
    HouseCalendarActivity,
    HousePassport,
    NeighborAd,
    NewsItem,
    TrashPickupRow,
    UkContacts,
    UkTransparencyStats,
    Vote,
    VoteCast,
} from "../types";
import { buildBuildingKey } from "../utils/buildingKey";
import { OWNERS_MEETING_CATEGORY } from "../utils/appeals";

export const ukContacts: UkContacts = {
    companyName: "УК «Домовой»",
    email: "office@domovoy.example",
    phone: "+7 (495) 123-45-67",
    site: "https://domovoy.example",
    hours: "Пн–Пт 9:00–18:00, приём по записи",
};

export const housePassport: HousePassport = {
    address: "г. Киров, пр-кт. Октябрьский, д. 117",
    yearBuilt: 2018,
    entrances: 3,
    apartments: 487,
    specs: [
        { label: "Серия / тип дома", value: "Панельный, И-155" },
        { label: "Этажность", value: "25 этажей +  подземная автостоянка" },
        { label: "Лифты (на 1 подъезд)", value: "1 пассажирский, 1 грузовой" },
        { label: "Отопление", value: "Центральное" },
        { label: "ХВС / ГВС", value: "Центральное водоснабжение" },
        { label: "Мусоропровод", value: "Отсутствует, контейнерная площадка" },
        { label: "Парковка", value: "Подземная + наземная парковка для жителей" },
        { label: "Охранный комплекс", value: "Служба охраны + видеонаблюдение входных групп" },
    ],
    photoUrls: [
        "https://kvartiry.kssk.ru/upload/resize_cache/iblock/123/1200_800_2/Arkhitektura-v-galeree-_-1.jpg",
        "https://kvartiry.kssk.ru/upload/resize_cache/iblock/c74/1200_800_2/Y50A5440_min.jpg",
        "https://kvartiry.kssk.ru/upload/resize_cache/iblock/024/1200_800_2/S_TGTBTVTA_TBTV_2_min.jpg",
    ],
};

export {
    districtMapCenter,
    districtPois,
    homeMapAnchor,
} from "./districtPois";

const demoHouseKey = buildBuildingKey(housePassport.address);

export const seedNews: NewsItem[] = [
    {
        id: "n1",
        buildingKey: demoHouseKey,
        title: "Собрание собственников — 15 апреля",
        excerpt:
            "Очно в актовом зале школы № 1424. Повестка: капремонт фасада, благоустройство двора.",
        date: "2026-04-01",
        imageUrls: [
            "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80",
            "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80",
        ],
    },
    {
        id: "n2",
        buildingKey: demoHouseKey,
        title: "Плановая промывка системы отопления",
        excerpt: "26–27 апреля возможно снижение температуры теплоносителя в пробных контурах.",
        date: "2026-03-28",
        imageUrls: [
            "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&q=80",
        ],
    },
    {
        id: "n3",
        buildingKey: demoHouseKey,
        title: "Новые контейнеры для раздельного сбора",
        excerpt: "Установлены площадки для пластика и стекла у въезда с ул. Липовая.",
        date: "2026-03-20",
        imageUrls: [
            "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&q=80",
            "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=600&q=80",
            "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?w=600&q=80",
        ],
    },
];

export const seedNotifications: AppNotification[] = [
    {
        id: "g1",
        title: "Аварийное отключение горячей воды",
        body: "Котельная: устранение утечки. Ориентировочно до 22:00.",
        type: "outage",
        date: "2026-04-02T09:00:00",
        read: false,
    },
    {
        id: "g2",
        title: "Плановые работы по электроснабжению",
        body: "3 апреля с 10:00 до 12:00 отключение лифтов в подъездах 1–2.",
        type: "outage",
        date: "2026-04-02T08:00:00",
        read: false,
    },
    {
        id: "g3",
        title: "Собрание собственников",
        body: "Напоминание: 15 апреля, 19:00. Регистрация с 18:30.",
        type: "meeting",
        date: "2026-04-01T12:00:00",
        read: true,
    },
    {
        id: "g4",
        title: "Объявление УК",
        body: "Обновлены правила пользования парковкой гостевой зоны.",
        type: "announcement",
        date: "2026-03-30T10:00:00",
        read: true,
    },
];

export const seedAppeals: Appeal[] = [
    {
        id: "a1",
        title: "Протечка с верхнего этажа",
        body: "Потолок в санузле, пятно увеличивается третий день.",
        category: "emergency",
        status: "in_progress",
        createdAt: "2026-03-28T14:20:00",
        kind: "personal",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        authorApartment: "12",
        participants: [],
        imageUrls: [],
    },
    {
        id: "a2",
        title: "Не работает домофон",
        body: "Подъезд 3, панель не реагирует на ключи.",
        category: "electrical",
        status: "accepted",
        createdAt: "2026-03-25T11:00:00",
        kind: "personal",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        authorApartment: "101",
        participants: [],
        imageUrls: [],
    },
    {
        id: "a3",
        title: "Шум от соседей",
        body: "Громкая музыка после 23:00, кв. 84.",
        category: "order_violation",
        status: "resolved",
        createdAt: "2026-03-10T09:30:00",
        kind: "personal",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        authorApartment: "84",
        participants: [],
        imageUrls: [],
    },
    {
        id: "a_col_demo",
        title: "Коллективно: сквозняк в подъезде 2",
        body: "Дверь на этаже не закрывается, холодный воздух. Просим УК устранить.",
        category: "electrical",
        status: "new",
        createdAt: "2026-05-01T10:00:00",
        kind: "collective",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        entrance: "2",
        authorApartment: "40",
        imageUrls: [],
        participants: [
            {
                userId: "seed_n1",
                apartment: "45",
                entrance: "2",
                displayName: "Иван П.",
                anonymous: false,
                comment: "Поддерживаю, у нас на этаже дует",
                joinedAt: "2026-05-01T11:00:00",
            },
            {
                userId: "seed_n2",
                apartment: "47",
                entrance: "2",
                displayName: "Сосед",
                anonymous: true,
                joinedAt: "2026-05-01T12:30:00",
            },
        ],
    },
];

const monthMs = 30 * 24 * 60 * 60 * 1000;

export const seedNeighborAds: NeighborAd[] = [
    {
        id: "ad1",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        title: "Продаю детскую коляску",
        body: "Состояние хорошее, пользовались 8 месяцев. Самовывоз.",
        category: "sell",
        showPhone: false,
        authorPhone: undefined,
        createdAt: "2026-04-20T12:00:00",
        expiresAt: new Date(
            new Date("2026-04-20T12:00:00").getTime() + monthMs,
        ).toISOString(),
        archived: false,
        imageUrls: [],
    },
    {
        id: "ad2",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        title: "Ищу няню на вечер пятницы",
        body: "Ребёнку 4 года, район школы № 1424.",
        category: "service",
        showPhone: true,
        authorPhone: "+7 (900) 000-00-00",
        createdAt: "2026-05-05T09:00:00",
        expiresAt: new Date(
            new Date("2026-05-05T09:00:00").getTime() + monthMs,
        ).toISOString(),
        imageUrls: [],
    },
    {
        id: "ad_lost1",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        title: "Потерян ключ с брелоком Audi",
        body: "Вчера вечером у подъезда 2. Нашедшего прошу написать.",
        category: "lost",
        showPhone: true,
        authorPhone: "+7 (900) 000-00-00",
        createdAt: "2026-05-09T18:00:00",
        expiresAt: new Date(
            new Date("2026-05-09T18:00:00").getTime() + monthMs,
        ).toISOString(),
        archived: false,
        imageUrls: [],
    },
    {
        id: "ad_found1",
        authorUserId: "seed",
        buildingKey: demoHouseKey,
        title: "Найдена детская шапка (розовая)",
        body: "У почтовых ящиков в подъезде 1, полка над батареей.",
        category: "found",
        showPhone: false,
        authorPhone: undefined,
        createdAt: "2026-05-10T11:00:00",
        expiresAt: new Date(
            new Date("2026-05-10T11:00:00").getTime() + monthMs,
        ).toISOString(),
        archived: false,
        imageUrls: [],
    },
];

export const seedVotes: Vote[] = [
    {
        id: "v_demo_trial",
        buildingKey: demoHouseKey,
        sponsor: "residents",
        trial: true,
        createdByLabel: "Пример для жильцов",
        topic: "Пробное голосование: как это работает",
        description:
            "Демонстрационная карточка: так выглядит голосование соседей. Проголосуйте, чтобы проверить интерфейс.",
        options: [
            { id: "v_demo_trial_o1", label: "Всё понятно, интерфейс устраивает" },
            { id: "v_demo_trial_o2", label: "Хочется доработок" },
        ],
        endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: "open",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "v1",
        buildingKey: demoHouseKey,
        sponsor: "uk",
        createdByLabel: "УК «Домовой»",
        topic: "Установка видеокамеры во дворе",
        description:
            "Предлагается установить камеру у детской площадки за счёт средств ФКР. Срок голосования — 7 дней.",
        options: [
            { id: "v1o1", label: "За" },
            { id: "v1o2", label: "Против" },
            { id: "v1o3", label: "Воздержаться" },
        ],
        endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: "open",
        createdAt: "2026-05-08T08:00:00",
    },
    {
        id: "v2",
        buildingKey: demoHouseKey,
        sponsor: "residents",
        createdByLabel: "Инициативная группа",
        topic: "Выбор подрядчика по косметическому ремонту подъезда",
        description: "Тайное голосование между двумя допущенными организациями.",
        options: [
            { id: "v2o1", label: "ООО «СтройКомфорт»" },
            { id: "v2o2", label: "ООО «РемДом»" },
        ],
        endsAt: "2026-04-01T23:59:59",
        visibility: "secret",
        createdAt: "2026-03-20T10:00:00",
        closed: true,
    },
];

export const seedVoteCasts: VoteCast[] = [
    {
        voteId: "v2",
        apartmentId: "seed-apt-1",
        userId: "seed",
        optionId: "v2o1",
        votedAt: "2026-03-25T14:00:00",
    },
    {
        voteId: "v2",
        apartmentId: "seed-apt-2",
        userId: "seed_owner2",
        optionId: "v2o2",
        votedAt: "2026-03-26T10:30:00",
    },
];

/** Плановые события по дому — отображаются в календаре на месяц */
export const houseCalendarActivities: HouseCalendarActivity[] = [
    { id: "ca1", date: "2026-05-03", title: "Уборка двора и МАФ", kind: "yard" },
    { id: "ca2", date: "2026-05-07", title: "Замена участка стояка ХВС (подъезд 1)", kind: "pipes" },
    { id: "ca3", date: "2026-05-10", title: "Собрание собственников (онлайн)", kind: "meeting" },
    { id: "ca4", date: "2026-05-14", title: "Уборка двора и МАФ", kind: "yard" },
    { id: "ca5", date: "2026-05-18", title: "Промывка системы отопления (пробный контур)", kind: "heating" },
    { id: "ca6", date: "2026-05-21", title: "Вывоз крупногабарита (площадка)", kind: "garbage" },
    { id: "ca7", date: "2026-05-24", title: "Уборка двора и МАФ", kind: "yard" },
    { id: "ca8", date: "2026-05-28", title: "Проверка лифтов (плановая)", kind: "other" },
    { id: "ca9", date: "2026-06-01", title: "Уборка двора и МАФ", kind: "yard" },
    { id: "ca10", date: "2026-06-11", title: "Окраска металлоконструкций входных групп", kind: "other" },
];

/** Расписание вывоза и обслуживания мусорной площадки */
export const trashPickupSchedule: TrashPickupRow[] = [
    {
        id: "t1",
        title: "ТКО (смешанные отходы)",
        schedule: "Понедельник, среда, пятница",
        note: "Вывоз с контейнерной площадки после 8:00",
    },
    {
        id: "t2",
        title: "Раздельный сбор (пластик, бумага)",
        schedule: "По вторникам",
        note: "Пластик — синий контейнер, макулатура — жёлтый",
    },
    {
        id: "t3",
        title: "Крупногабарит и вторсырьё",
        schedule: "1-я суббота каждого месяца",
        note: "С 9:00 до 14:00 на площадке у въезда",
    },
    {
        id: "t4",
        title: "Органические отходы (пилот)",
        schedule: "Четверг",
        note: "Коричневый контейнер — только для участников пилота",
    },
];

import { appealCategoryOptions } from "../constants/appealCategories";

export const appealCategories = appealCategoryOptions.map((o) => o.key);

/** Публичные метрики УК (имитация снимка раз в сутки, без ручной правки в приложении) */
export const ukTransparencyStats: UkTransparencyStats = {
    snapshotAtIso: "2026-05-11T06:00:00",
    avgAppealStars3m: 4.2,
    closedAppeals90d: 186,
    closedOnTimePercent: 78,
    avgCourtyardStars: null,
    avgEntranceStars: null,
    avgUkStars: null,
    ratingsCount: 0,
};

export const seedContractors: ContractorProfile[] = [
    {
        id: "c1",
        name: "ООО «АкваСервис»",
        workKinds: ["Сантехника", "Отопление"],
        avgStars: 4.6,
        closedJobsRated: 42,
    },
    {
        id: "c2",
        name: "«ЭлектроБезопасность»",
        workKinds: ["Электрика", "Щитовые"],
        avgStars: 4.3,
        closedJobsRated: 31,
    },
    {
        id: "c3",
        name: "Клининг «Чистый дом»",
        workKinds: ["Уборка МОП", "Подъезды"],
        avgStars: 4.1,
        closedJobsRated: 58,
    },
];

/** Доп. номера от УК — подмешиваются к стандартному списку аварийных */
export const ukEmergencyExtraContacts: EmergencyContactLine[] = [
    {
        id: "uk_dispatch",
        title: "Диспетчер УК (круглосуточно)",
        subtitle: "Аварийная заявка по дому",
        phone: "+74951234567",
    },
    {
        id: "uk_lift",
        title: "Лифтовая служба по договору",
        subtitle: "Подрядчик УК",
        phone: "+74959876543",
    },
];
