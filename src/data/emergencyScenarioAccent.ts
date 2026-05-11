import { colors } from "../theme/colors";
import type { EmergencyScenarioId } from "../types";

/** Цвет иконки категории и акцент шагов / кнопки звонка на экране сценария */
export const EMERGENCY_SCENARIO_ACCENT: Record<
    EmergencyScenarioId,
    { icon: string; soft: string; callText: string }
> = {
    fire: {
        icon: colors.danger,
        soft: colors.dangerSoft,
        callText: colors.bg,
    },
    gas: {
        icon: colors.warning,
        soft: "rgba(232, 162, 61, 0.18)",
        callText: colors.bg,
    },
    flood: {
        icon: colors.info,
        soft: "rgba(91, 159, 212, 0.18)",
        callText: colors.bg,
    },
    power: {
        icon: colors.accent,
        soft: colors.accentSoft,
        callText: colors.bg,
    },
};

export function emergencyScenarioAccent(
    id: string,
): (typeof EMERGENCY_SCENARIO_ACCENT)["fire"] {
    const a = EMERGENCY_SCENARIO_ACCENT[id as EmergencyScenarioId];
    return (
        a ?? {
            icon: colors.warning,
            soft: "rgba(232, 162, 61, 0.18)",
            callText: colors.bg,
        }
    );
}
