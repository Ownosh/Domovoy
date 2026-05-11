import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EmergencyCallBlock } from "../../components/safety/EmergencyCallBlock";
import { ScreenLayout } from "../../components/ui";
import { BASE_EMERGENCY_CONTACTS } from "../../data/emergencyDefaults";
import { EMERGENCY_GUIDE_SCENARIOS } from "../../data/emergencyGuideRu";
import { ukEmergencyExtraContacts } from "../../data/mockData";
import type { SafetyStackParamList } from "../../navigation/types";
import type { EmergencyContactLine } from "../../types";
import { emergencyScenarioAccent } from "../../data/emergencyScenarioAccent";
import { mergeEmergencyLines } from "../../utils/emergencyCache";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<SafetyStackParamList, "EmergencyGuideDetail">;

export function EmergencyGuideDetailScreen({ navigation, route }: Props) {
    const scenario = EMERGENCY_GUIDE_SCENARIOS.find((s) => s.id === route.params.scenario);
    const accent = emergencyScenarioAccent(route.params.scenario);

    const lineById = useMemo(() => {
        const all = mergeEmergencyLines(
            BASE_EMERGENCY_CONTACTS,
            ukEmergencyExtraContacts,
        );
        const m = new Map<string, EmergencyContactLine>();
        for (const l of all) m.set(l.id, l);
        return m;
    }, []);

    if (!scenario) {
        return (
            <ScreenLayout title="ЧС" onBack={() => navigation.goBack()}>
                <Text style={[textStyles.body, styles.miss]}>Сценарий не найден</Text>
            </ScreenLayout>
        );
    }

    return (
        <ScreenLayout
            title={scenario.title}
            scroll
            onBack={() => navigation.goBack()}
        >
            <View style={styles.steps}>
                {scenario.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                        <View
                            style={[
                                styles.stepNum,
                                { backgroundColor: accent.soft },
                            ]}
                        >
                            <Text
                                style={[
                                    textStyles.caption,
                                    styles.stepNumTxt,
                                    { color: accent.icon },
                                ]}
                            >
                                {i + 1}
                            </Text>
                        </View>
                        <Text style={[textStyles.body, styles.stepText]}>{step}</Text>
                    </View>
                ))}
            </View>
            <Text style={[textStyles.label, styles.callLabel]}>Позвонить</Text>
            <View style={styles.callList}>
                {scenario.callPhoneIds.map((pid) => {
                    const line = lineById.get(pid);
                    if (!line) return null;
                    return (
                        <EmergencyCallBlock
                            key={pid}
                            line={line}
                            callAccentColor={accent.icon}
                            callAccentTextColor={accent.callText}
                        />
                    );
                })}
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    miss: { color: colors.textMuted },
    steps: { gap: spacing.md, marginBottom: spacing.xl },
    stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
    stepNum: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    stepNumTxt: { fontWeight: "700" },
    stepText: { flex: 1, color: colors.text, lineHeight: 22 },
    callLabel: { color: colors.textMuted, marginBottom: spacing.sm },
    callList: { gap: spacing.md },
});
