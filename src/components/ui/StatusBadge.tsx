import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppealStatus, VerificationStatus } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

const appealLabels: Record<AppealStatus, string> = {
    new: "Новое",
    accepted: "Принято",
    in_progress: "В работе",
    resolved: "Решено",
    rejected: "Отклонено",
};

const appealColors: Record<AppealStatus, string> = {
    new: colors.info,
    accepted: colors.primary,
    in_progress: colors.warning,
    resolved: colors.primary,
    rejected: colors.danger,
};

const verificationLabels: Record<
    Exclude<VerificationStatus, "none">,
    string
> = {
    pending: "На рассмотрении",
    approved: "Подтверждён",
    rejected: "Отклонён",
};

const verificationColors: Record<
    Exclude<VerificationStatus, "none">,
    string
> = {
    pending: colors.warning,
    approved: colors.primary,
    rejected: colors.danger,
};

export function AppealStatusBadge({ status }: { status: AppealStatus }) {
    return (
        <View
            style={[
                styles.badge,
                { backgroundColor: `${appealColors[status]}22` },
            ]}
        >
            <Text style={[textStyles.caption, { color: appealColors[status] }]}>
                {appealLabels[status]}
            </Text>
        </View>
    );
}

export function VerificationStatusBadge({
    status,
}: {
    status: VerificationStatus;
}) {
    if (status === "none") return null;
    const c = verificationColors[status];
    return (
        <View style={[styles.badge, { backgroundColor: `${c}22` }]}>
            <Text style={[textStyles.caption, { color: c }]}>
                {verificationLabels[status]}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
});
