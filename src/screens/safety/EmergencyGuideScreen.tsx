import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenLayout } from "../../components/ui";
import { emergencyScenarioAccent } from "../../data/emergencyScenarioAccent";
import { EMERGENCY_GUIDE_SCENARIOS } from "../../data/emergencyGuideRu";
import type { SafetyStackParamList } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    fire: "flame-outline",
    gas: "warning-outline",
    flood: "water-outline",
    power: "flash-off-outline",
};

type Props = NativeStackScreenProps<SafetyStackParamList, "EmergencyGuide">;

export function EmergencyGuideScreen({ navigation }: Props) {
    return (
        <ScreenLayout
            title="При ЧС"
            subtitle="Выберите ситуацию"
            onBack={() => navigation.goBack()}
        >
            {EMERGENCY_GUIDE_SCENARIOS.map((s) => {
                const accent = emergencyScenarioAccent(s.id);
                return (
                    <Pressable
                        key={s.id}
                        onPress={() =>
                            navigation.navigate("EmergencyGuideDetail", {
                                scenario: s.id,
                            })
                        }
                        style={({ pressed }) => [
                            styles.card,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Ionicons
                            name={icons[s.id] ?? "alert-circle-outline"}
                            size={26}
                            color={accent.icon}
                        />
                        <View style={styles.texts}>
                            <Text style={[textStyles.subtitle, styles.title]}>
                                {s.shortTitle}
                            </Text>
                            <Text
                                style={[textStyles.caption, styles.sub]}
                                numberOfLines={2}
                            >
                                {s.steps[0]}
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={22}
                            color={colors.textDim}
                        />
                    </Pressable>
                );
            })}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    pressed: { opacity: 0.92 },
    texts: { flex: 1 },
    title: { color: colors.text },
    sub: { color: colors.textMuted, marginTop: 4 },
});
