import type {
    Appeal,
    AppNotification,
    DistrictPoi,
    HousePassport,
    NewsItem,
    UkContacts,
} from "../types";

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
    apartments: 192,
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

/** Центр карты — рядом с пр. Октябрьский, 117 (г. Киров) */
const center = { lat: 58.5844, lng: 49.6605 };

export const districtPois: DistrictPoi[] = [
    {
        id: "p1",
        name: "Лицей № 39",
        category: "education",
        address: "г. Киров, пр. Октябрьский, 99",
        lat: 58.5856,
        lng: 49.6588,
    },
    {
        id: "p2",
        name: "Детский сад № 194",
        category: "education",
        address: "г. Киров, ул. Ленина, 198",
        lat: 58.5832,
        lng: 49.6624,
    },
    {
        id: "p3",
        name: "Городская поликлиника № 2",
        category: "health",
        address: "г. Киров, пр. Октябрьский, 24",
        lat: 58.5868,
        lng: 49.6555,
    },
    {
        id: "p4",
        name: "ТЦ «Глобус»",
        category: "shopping",
        address: "г. Киров, пр. Октябрьский, 82",
        lat: 58.585,
        lng: 49.6579,
    },
    {
        id: "p5",
        name: "Сквер у Дворца молодёжи",
        category: "leisure",
        address: "г. Киров, пр. Октябрьский (зона отдыха)",
        lat: 58.5825,
        lng: 49.6638,
    },
    {
        id: "p6",
        name: "Аптека «Фармленд»",
        category: "health",
        address: "г. Киров, пр. Октябрьский, 105",
        lat: 58.5849,
        lng: 49.6592,
    },
];

export { center as districtMapCenter };

export const seedNews: NewsItem[] = [
    {
        id: "n1",
        title: "Собрание собственников — 15 апреля",
        excerpt:
            "Очно в актовом зале школы № 1424. Повестка: капремонт фасада, благоустройство двора.",
        date: "2026-04-01",
        imageUrl: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80",
    },
    {
        id: "n2",
        title: "Плановая промывка системы отопления",
        excerpt: "26–27 апреля возможно снижение температуры теплоносителя в пробных контурах.",
        date: "2026-03-28",
        imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&q=80",
    },
    {
        id: "n3",
        title: "Новые контейнеры для раздельного сбора",
        excerpt: "Установлены площадки для пластика и стекла у въезда с ул. Липовая.",
        date: "2026-03-20",
        imageUrl: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&q=80",
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
        category: "Аварийная ситуация",
        status: "in_progress",
        createdAt: "2026-03-28T14:20:00",
    },
    {
        id: "a2",
        title: "Не работает домофон",
        body: "Подъезд 3, панель не реагирует на ключи.",
        category: "Оборудование",
        status: "accepted",
        createdAt: "2026-03-25T11:00:00",
    },
    {
        id: "a3",
        title: "Шум от соседей",
        body: "Громкая музыка после 23:00, кв. 84.",
        category: "Нарушение порядка",
        status: "resolved",
        createdAt: "2026-03-10T09:30:00",
    },
];

export const appealCategories = [
    "Аварийная ситуация",
    "Сантехника",
    "Электрика",
    "Отопление / вентиляция",
    "Оборудование",
    "Уборка / благоустройство",
    "Нарушение порядка",
    "Другое",
];
