import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../theme";

export type TimelineStep = {
    key: string;
    label: string;
    color: string;
    icon?: string;
};

type Props = {
    steps: TimelineStep[];
    currentKey: string;
};

export function StatusTimeline({ steps, currentKey }: Props) {
    const currentIdx = steps.findIndex((s) => s.key === currentKey);

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {steps.map((step, i) => {
                const isCurrent = i === currentIdx;
                const isPast = currentIdx >= 0 && i < currentIdx;
                const c = step.color;

                const iconOpacity = isCurrent ? 1 : isPast ? 0.65 : 0.3;
                const iconColor = isCurrent ? c : isPast ? c : colors.textDim;

                return (
                    <View key={step.key} style={styles.itemRow}>
                        <View
                            style={[
                                styles.step,
                                isCurrent
                                    ? { backgroundColor: `${c}22`, borderColor: c }
                                    : isPast
                                    ? { borderColor: `${c}44`, backgroundColor: `${c}0a` }
                                    : { borderColor: colors.border },
                            ]}
                        >
                            {step.icon ? (
                                <Ionicons
                                    name={step.icon as keyof typeof Ionicons.glyphMap}
                                    size={12}
                                    color={iconColor}
                                    style={{ opacity: iconOpacity }}
                                />
                            ) : (
                                <View
                                    style={[
                                        styles.dot,
                                        { backgroundColor: iconColor, opacity: iconOpacity },
                                    ]}
                                />
                            )}
                            <Text
                                style={[
                                    styles.label,
                                    {
                                        color: isCurrent ? c : isPast ? c : colors.textDim,
                                        opacity: isCurrent ? 1 : isPast ? 0.65 : 0.35,
                                        fontWeight: isCurrent ? "700" : "600",
                                    },
                                ]}
                            >
                                {step.label}
                            </Text>
                        </View>
                        {i < steps.length - 1 && (
                            <Ionicons
                                name="chevron-forward"
                                size={12}
                                color={colors.border}
                                style={[
                                    styles.arrow,
                                    { opacity: isPast || isCurrent ? 0.7 : 0.3 },
                                ]}
                            />
                        )}
                    </View>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    itemRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    step: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        borderRadius: radius.full,
        borderWidth: 1,
        gap: 5,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    label: {
        fontSize: 11,
        letterSpacing: 0.2,
    },
    arrow: {
        marginHorizontal: 3,
    },
});
