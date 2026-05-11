import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { UkTransparencyStats } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = {
    stats: UkTransparencyStats;
};

export function UkPublicStatsCard({ stats }: Props) {
    const when = formatSnapshot(stats.snapshotAtIso);
    return (
        <View style={styles.wrap}>
            <Text style={[textStyles.subtitle, styles.title]}>
                Публичная статистика УК
            </Text>
            <Text style={[textStyles.caption, styles.note]}>
                Снимок обновляется автоматически раз в сутки. Ручная корректировка в
                приложении недоступна.
            </Text>
            <View style={styles.grid}>
                <View style={styles.cell}>
                    <Text style={[textStyles.caption, styles.k]}>
                        Средняя оценка заявок (3 мес.)
                    </Text>
                    <Text style={[textStyles.title, styles.v]}>
                        {stats.avgAppealStars3m.toFixed(1)} ★
                    </Text>
                </View>
                <View style={styles.cell}>
                    <Text style={[textStyles.caption, styles.k]}>
                        Закрытых обращений (90 дней)
                    </Text>
                    <Text style={[textStyles.title, styles.v]}>
                        {stats.closedAppeals90d}
                    </Text>
                </View>
                <View style={[styles.cell, styles.cellWide]}>
                    <Text style={[textStyles.caption, styles.k]}>
                        Закрыто в срок
                    </Text>
                    <Text style={[textStyles.title, styles.v]}>
                        {stats.closedOnTimePercent}%
                    </Text>
                </View>
            </View>
            <Text style={[textStyles.caption, styles.when]}>Данные на: {when}</Text>
        </View>
    );
}

function formatSnapshot(iso: string): string {
    try {
        return new Date(iso).toLocaleString("ru-RU", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    wrap: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    title: { color: colors.text },
    note: { color: colors.textMuted, lineHeight: 18 },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    cell: {
        flexGrow: 1,
        minWidth: "42%",
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        padding: spacing.md,
    },
    cellWide: { minWidth: "100%" },
    k: { color: colors.textDim },
    v: { color: colors.primary, marginTop: spacing.xs },
    when: { color: colors.textDim, marginTop: spacing.sm },
});
