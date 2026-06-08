import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppealStatus, NeighborAdStatus, VerificationStatus, VoteStatus } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

// ─── Appeals ────────────────────────────────────────────────────────────────

const appealLabels: Record<AppealStatus, string> = {
    new: "Новое",
    collecting_signatures: "Сбор подписей",
    in_progress: "В работе",
    resolved: "Решено",
    closed: "Закрыто",
    rejected: "Отклонено",
};

export const appealStatusColor: Record<AppealStatus, string> = {
    new: colors.info,
    collecting_signatures: colors.warning,
    in_progress: colors.accent,
    resolved: colors.primary,
    closed: colors.textMuted,
    rejected: colors.danger,
};

export function AppealStatusBadge({ status }: { status: AppealStatus }) {
    const c = appealStatusColor[status] ?? colors.textMuted;
    return (
        <View style={[styles.badge, { backgroundColor: `${c}22` }]}>
            <Text style={[textStyles.caption, { color: c }]}>{appealLabels[status] ?? status}</Text>
        </View>
    );
}

// ─── Votes ───────────────────────────────────────────────────────────────────

const voteLabels: Record<VoteStatus, string> = {
    new: "Новое",
    under_review: "На проверке",
    active: "Идёт голосование",
    completed: "Завершено",
    cancelled: "Отменено",
};

export const voteStatusColor: Record<VoteStatus, string> = {
    new: colors.info,
    under_review: colors.warning,
    active: colors.accent,
    completed: colors.primary,
    cancelled: colors.textMuted,
};

export function VoteStatusBadge({ status }: { status: VoteStatus }) {
    const c = voteStatusColor[status] ?? colors.textMuted;
    return (
        <View style={[styles.badge, { backgroundColor: `${c}22` }]}>
            <Text style={[textStyles.caption, { color: c }]}>{voteLabels[status] ?? status}</Text>
        </View>
    );
}

// ─── Neighbor Ads ─────────────────────────────────────────────────────────────

const adLabels: Record<NeighborAdStatus, string> = {
    new: "Новое",
    under_review: "На проверке",
    published: "Опубликовано",
    archived: "В архиве",
    rejected: "Отклонено",
    under_review_appeal: "На повторной проверке",
};

export const adStatusColor: Record<NeighborAdStatus, string> = {
    new: colors.info,
    under_review: colors.warning,
    published: colors.primary,
    archived: colors.textMuted,
    rejected: colors.danger,
    under_review_appeal: colors.warning,
};

export function AdStatusBadge({ status }: { status: NeighborAdStatus }) {
    const c = adStatusColor[status] ?? colors.textMuted;
    return (
        <View style={[styles.badge, { backgroundColor: `${c}22` }]}>
            <Text style={[textStyles.caption, { color: c }]}>{adLabels[status] ?? status}</Text>
        </View>
    );
}

// ─── Verification ─────────────────────────────────────────────────────────────

const verificationLabels: Record<Exclude<VerificationStatus, "none">, string> = {
    pending: "На рассмотрении",
    approved: "Подтверждён",
    rejected: "Отклонён",
};

const verificationColors: Record<Exclude<VerificationStatus, "none">, string> = {
    pending: colors.warning,
    approved: colors.primary,
    rejected: colors.danger,
};

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
    if (status === "none") return null;
    const c = verificationColors[status];
    return (
        <View style={[styles.badge, { backgroundColor: `${c}22` }]}>
            <Text style={[textStyles.caption, { color: c }]}>{verificationLabels[status]}</Text>
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
