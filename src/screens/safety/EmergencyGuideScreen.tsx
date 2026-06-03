import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ScreenLayout } from "../../components/ui";
import { emergencyScenarioAccent } from "../../data/emergencyScenarioAccent";
import { EMERGENCY_GUIDE_SCENARIOS } from "../../data/emergencyGuideRu";
import type { SafetyStackParamList } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    fire: "flame-outline",
    gas: "warning-outline",
    flood: "water-outline",
    power: "flash-off-outline",
};

function Divider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}

type Props = NativeStackScreenProps<SafetyStackParamList, "EmergencyGuide">;

export function EmergencyGuideScreen({ navigation }: Props) {
    return (
        <ScreenLayout
            title="При ЧС"
            subtitle="Выберите ситуацию"
            onBack={() => navigation.goBack()}
        >
            <View style={styles.list}>
                {EMERGENCY_GUIDE_SCENARIOS.map((s, index) => {
                    const accent = emergencyScenarioAccent(s.id);
                    return (
                        <React.Fragment key={s.id}>
                            {index > 0 && <Divider />}
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("EmergencyGuideDetail", { scenario: s.id })
                                }
                                style={({ pressed }) => [pressed && styles.pressed]}
                            >
                                <Card style={[styles.card, { borderLeftColor: accent.icon }]} padded>
                                    <View style={styles.cardTop}>
                                        <View style={[styles.badge, { backgroundColor: accent.soft }]}>
                                            <Text style={[styles.badgeText, { color: accent.icon }]}>
                                                {s.shortTitle}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.rowInner}>
                                        <Ionicons
                                            name={icons[s.id] ?? "alert-circle-outline"}
                                            size={26}
                                            color={accent.icon}
                                        />
                                        <View style={styles.texts}>
                                            <Text style={[textStyles.subtitle, styles.title]}>
                                                {s.shortTitle}
                                            </Text>
                                            <Text style={[textStyles.caption, styles.sub]} numberOfLines={2}>
                                                {s.steps[0]}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                                    </View>
                                </Card>
                            </Pressable>
                        </React.Fragment>
                    );
                })}
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    list: { gap: 0 },
    card: {
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
    },
    cardTop: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        marginBottom: spacing.sm,
    },
    badge: {
        alignSelf: "flex-start" as const,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: { fontSize: 11, fontWeight: "600" as const },
    rowInner: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: spacing.md,
    },
    pressed: { opacity: 0.92 },
    texts: { flex: 1 },
    title: { color: colors.text },
    sub: { color: colors.textMuted, marginTop: 4 },
    divider: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: spacing.lg,
        marginVertical: spacing.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    dividerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginHorizontal: spacing.md,
    },
});
