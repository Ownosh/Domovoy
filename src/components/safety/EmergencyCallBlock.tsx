import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EmergencyContactLine } from "../../types";
import { openTel } from "../../utils/dialPhone";
import { colors, radius, spacing, textStyles } from "../../theme";

type EmergencyCallBlockProps = {
    line: EmergencyContactLine;
    callAccentColor?: string;
    callAccentTextColor?: string;
    leftBorderColor?: string;
    badgeLabel?: string;
};

export function EmergencyCallBlock({
    line,
    callAccentColor = colors.primary,
    callAccentTextColor = colors.bg,
    leftBorderColor,
    badgeLabel,
}: EmergencyCallBlockProps) {
    return (
        <View style={[styles.block, leftBorderColor ? { borderLeftWidth: 3, borderLeftColor: leftBorderColor } : null]}>
            {badgeLabel ? (
                <View style={[styles.badge, { backgroundColor: `${leftBorderColor ?? colors.primary}22` }]}>
                    <Text style={[styles.badgeText, { color: leftBorderColor ?? colors.primary }]}>
                        {badgeLabel}
                    </Text>
                </View>
            ) : null}
            <Text style={[textStyles.subtitle, styles.t]}>{line.title}</Text>
            {line.subtitle ? (
                <Text style={[textStyles.caption, styles.s]}>{line.subtitle}</Text>
            ) : null}
            <Text style={[textStyles.caption, styles.num]}>{line.phone}</Text>
            <Pressable
                onPress={() => openTel(line.phone)}
                style={({ pressed }) => [
                    styles.callBtn,
                    { backgroundColor: callAccentColor },
                    pressed && styles.callBtnPressed,
                ]}
            >
                <Text style={[textStyles.subtitle, styles.callTxtBold, { color: callAccentTextColor }]}>
                    Позвонить
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    block: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.xs,
    },
    badge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: spacing.sm,
    },
    badgeText: { fontSize: 11, fontWeight: "700" },
    t: { color: colors.text },
    s: { color: colors.textDim, lineHeight: 18 },
    num: { color: colors.textMuted, marginTop: spacing.xs },
    callBtn: {
        marginTop: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
    },
    callBtnPressed: { opacity: 0.9 },
    callTxtBold: { fontWeight: "700" },
});
