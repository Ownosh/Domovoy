import type { EmergencyScenarioId } from "../types";

export type GuideScenarioDef = {
    id: EmergencyScenarioId;
    title: string;
    shortTitle: string;
    steps: string[];
    /** Номера из BASE / extras — подставляются на экране */
    callPhoneIds: string[];
};

export const EMERGENCY_GUIDE_SCENARIOS: GuideScenarioDef[] = [
    {
        id: "fire",
        title: "Пожар",
        shortTitle: "Пожар",
        steps: [
            "Нажмите кнопку пожарной сигнализации, эвакуируйтесь по лестнице",
            "Не пользуйтесь лифтом, не открывайте дымные двери",
            "Сообщите адрес и этаж диспетчеру 112",
        ],
        callPhoneIds: ["e112"],
    },
    {
        id: "gas",
        title: "Утечка газа",
        shortTitle: "Газ",
        steps: [
            "Не включайте свет и технику, не пользуйтесь открытым огнём",
            "Откройте окна, перекройте кран на плите, выйдите из квартиры",
            "Вызовите газовую службу и 112 при угрозе",
        ],
        callPhoneIds: ["gas", "e112"],
    },
    {
        id: "flood",
        title: "Затопление",
        shortTitle: "Затопление",
        steps: [
            "Отключите электричество в щитке, если вода доходит до розеток",
            "Перекройте воду: стояк в квартире или общий вентиль",
            "Сфотографируйте ущерб, сообщите УК и соседям сверху",
        ],
        callPhoneIds: ["plumb", "uk_dispatch"],
    },
    {
        id: "power",
        title: "Отключение электричества",
        shortTitle: "Свет",
        steps: [
            "Проверьте автоматы в щитке — один кабинет или весь дом",
            "Отключите мощную технику перед включением автоматов",
            "Если искрит проводка — не трогайте, вызывайте электриков",
        ],
        callPhoneIds: ["elec", "e112"],
    },
];
