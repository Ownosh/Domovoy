import type { EmergencyContactLine } from "../types";

/** Базовый набор (вшит в приложение, доступен офлайн) */
export const BASE_EMERGENCY_CONTACTS: EmergencyContactLine[] = [
    {
        id: "e112",
        title: "Единая служба спасения",
        phone: "112",
    },
    {
        id: "gas",
        title: "Аварийная газовая служба",
        phone: "104",
    },
    {
        id: "plumb",
        title: "Аварийная сантехника",
        subtitle: "Диспетчерская (пример)",
        phone: "84951234567",
    },
    {
        id: "elec",
        title: "Аварийные электрики",
        subtitle: "Обрыв, искрение, падение напряжения",
        phone: "84951234567",
    },
    {
        id: "lift",
        title: "Лифтовая аварийная",
        subtitle: "Застревание, падение кабины — до приезда не пользуйтесь лифтом",
        phone: "84951234567",
    },
    {
        id: "police",
        title: "Полиция",
        phone: "102",
    },
    {
        id: "ambulance",
        title: "Скорая помощь",
        phone: "103",
    },
];
