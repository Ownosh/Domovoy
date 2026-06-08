import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
            <View style={styles.numWrap}>
                <Ionicons name="call-outline" size={13} color={callAccentColor} />
                <Text style={[styles.num, { color: callAccentColor }]}>{line.phone}</Text>
            </View>
            <Pressable
                onPress={() => openTel(line.phone)}
                style={({ pressed }) => [
                    styles.callBtn,
                    { backgroundColor: callAccentColor, shadowColor: callAccentColor },
                    pressed && styles.callBtnPressed,
                ]}
            >
                <Ionicons name="call-outline" size={16} color={callAccentTextColor} style={styles.callIcon} />
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
    numWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginTop: spacing.sm,
        alignSelf: "flex-start",
        backgroundColor: colors.bgElevated,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    num: { fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
    callBtn: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.xxl,
        borderRadius: radius.full,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-end",
        gap: spacing.sm,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 5,
        elevation: 3,
    },
    callIcon: { marginTop: 1 },
    callBtnPressed: { opacity: 0.84, transform: [{ scale: 0.97 }] },
    callTxtBold: { fontWeight: "700", letterSpacing: 0.3 },
});
