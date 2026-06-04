import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { UkTransparencyStats } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = {
    stats: Partial<UkTransparencyStats>;
};

function Stars({ value }: { value: number | null | undefined }) {
    if (value == null) return <Text style={styles.noData}>нет данных</Text>;
    return (
        <View style={styles.starsRow}>
            <Text style={[textStyles.title, styles.v]}>{value.toFixed(1)}</Text>
            <Text style={styles.star}> ★</Text>
        </View>
    );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View style={styles.cell}>
            <Text style={[textStyles.caption, styles.k]}>{label}</Text>
            {children}
        </View>
    );
}

export function UkPublicStatsCard({ stats }: Props) {
    const when = stats.snapshotAtIso ? formatSnapshot(stats.snapshotAtIso) : null;
    const hasRatings = (stats.ratingsCount ?? 0) > 0;

    return (
        <View style={styles.wrap}>
            <Text style={[textStyles.subtitle, styles.title]}>
                Публичная статистика УК
            </Text>
            {when && (
                <Text style={[textStyles.caption, styles.note]}>
                    Снимок обновляется автоматически раз в сутки.
                </Text>
            )}

            {/* Оценки жильцов */}
            <Text style={[textStyles.caption, styles.sectionLabel]}>
                Оценки жильцов{hasRatings ? ` · ${stats.ratingsCount} оценок` : ""}
            </Text>
            <View style={styles.grid}>
                <StatCell label="Двор">
                    <Stars value={stats.avgCourtyardStars} />
                </StatCell>
                <StatCell label="Подъезд">
                    <Stars value={stats.avgEntranceStars} />
                </StatCell>
                <StatCell label="УК в целом">
                    <Stars value={stats.avgUkStars} />
                </StatCell>
            </View>

            {/* Обращения */}
            {(stats.avgAppealStars3m != null || stats.closedAppeals90d != null) && (
                <>
                    <Text style={[textStyles.caption, styles.sectionLabel]}>Обращения</Text>
                    <View style={styles.grid}>
                        {stats.avgAppealStars3m != null && (
                            <StatCell label="Средняя оценка (3 мес.)">
                                <View style={styles.starsRow}>
                                    <Text style={[textStyles.title, styles.v]}>
                                        {stats.avgAppealStars3m.toFixed(1)}
                                    </Text>
                                    <Text style={styles.star}> ★</Text>
                                </View>
                            </StatCell>
                        )}
                        {stats.closedAppeals90d != null && (
                            <StatCell label="Закрыто за 90 дней">
                                <Text style={[textStyles.title, styles.v]}>
                                    {stats.closedAppeals90d}
                                </Text>
                            </StatCell>
                        )}
                        {stats.closedOnTimePercent != null && (
                            <StatCell label="Закрыто в срок">
                                <Text style={[textStyles.title, styles.v]}>
                                    {stats.closedOnTimePercent}%
                                </Text>
                            </StatCell>
                        )}
                    </View>
                </>
            )}

            {when && (
                <Text style={[textStyles.caption, styles.when]}>Данные на: {when}</Text>
            )}
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
    sectionLabel: {
        color: colors.textDim,
        marginTop: spacing.xs,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        fontSize: 11,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    cell: {
        flexGrow: 1,
        minWidth: "28%",
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        padding: spacing.md,
    },
    k: { color: colors.textDim, marginBottom: spacing.xs },
    v: { color: colors.primary },
    starsRow: { flexDirection: "row", alignItems: "baseline" },
    star: { color: colors.accent, fontSize: 16 },
    noData: { color: colors.textDim, fontSize: 13 },
    when: { color: colors.textDim, marginTop: spacing.sm },
});
