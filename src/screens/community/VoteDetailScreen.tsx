import { Ionicons } from "@expo/vector-icons";
import type { CommunityScreenProps } from "../../navigation/types";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
    Alert,
    StyleSheet,
    Text,
    View,
} from "react-native";

function SectionDivider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}
import { Button, Card, ScreenLayout, VerificationWall } from "../../components/ui";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import type { Vote, VoteCast } from "../../types";
import { voteSourceLine } from "../../utils/voteSponsor";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"VoteDetail">;

// Если экран открыт через Community-модал — закрываем весь модал.
// Если открыт внутри вкладки (Appeals стек) — просто goBack().
function useModalBack() {
    const nav = useNavigation();
    const parentRouteNames = nav.getParent()?.getState()?.routeNames;
    const isModal = parentRouteNames?.includes("Main");
    return () => isModal ? nav.getParent()?.goBack() : nav.goBack();
}

function voteEnded(vote: Vote): boolean {
    return (
        Boolean(vote.closed) || new Date(vote.endsAt).getTime() <= Date.now()
    );
}

function aggregate(
    vote: Vote,
    casts: VoteCast[],
): { optionId: string; area: number; count: number }[] {
    const list = casts.filter((c) => c.voteId === vote.id);
    const map = new Map<string, { area: number; count: number }>();
    for (const o of vote.options) {
        map.set(o.id, { area: 0, count: 0 });
    }
    for (const c of list) {
        const cur = map.get(c.optionId);
        if (!cur) continue;
        cur.area += c.areaSqm;
        cur.count += 1;
    }
    return vote.options.map((o) => ({
        optionId: o.id,
        area: map.get(o.id)?.area ?? 0,
        count: map.get(o.id)?.count ?? 0,
    }));
}

export function VoteDetailScreen({ route }: Props) {
    const goBack = useModalBack();
    const { votes, voteCasts, castVote, verification, user } = useApp();
    const vote = votes.find((v) => v.id === route.params.id);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!vote || voteEnded(vote)) return;
        const t = setInterval(() => setTick((x) => x + 1), 1000);
        return () => clearInterval(t);
    }, [vote]);

    void tick;
    const ended = vote ? voteEnded(vote) : true;
    const myCast = vote
        ? voteCasts.find(
              (c) => c.voteId === vote.id && String(c.userId) === String(user?.id),
          )
        : undefined;

    const agg = useMemo(
        () => (vote ? aggregate(vote, voteCasts) : []),
        [vote, voteCasts],
    );

    const totalVotes = useMemo(
        () => agg.reduce((s, a) => s + a.count, 0),
        [agg],
    );

    if (!vote) {
        return (
            <ScreenLayout title="Голосование" onBack={goBack}>
                <Text style={[textStyles.body, styles.miss]}>
                    Голосование не найдено
                </Text>
            </ScreenLayout>
        );
    }

    const countdown = !ended ? formatRemaining(vote.endsAt) : null;
    const canVote =
        isVerifiedResident(verification) && !ended && !myCast;

    const onPick = (optionId: string) => {
        const r = castVote({ voteId: vote.id, optionId });
        if (!r.ok) Alert.alert("Нельзя проголосовать", "reason" in r ? r.reason : "");
    };

    const onPdf = () => {
        Alert.alert(
            "Протокол PDF",
            "В рабочей версии здесь будет скачивание итогового протокола с датой и временем каждого голоса и идентификаторами участников (или ЭП). Сейчас это демонстрация интерфейса.",
        );
    };

    return (
        <ScreenLayout
            title="Голосование"
            scroll
            onBack={goBack}
        >
            <Card style={styles.voteCard} padded>
                <View style={styles.cardTop}>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>Голосование</Text>
                    </View>
                    <Text style={styles.cardDate}>
                        {vote.visibility === "open" ? "открытое" : "тайное"}
                        {ended ? " · завершено" : ""}
                    </Text>
                </View>
                <Text style={[textStyles.caption, styles.sourceTag]}>
                    {voteSourceLine(vote)}
                </Text>
                <Text style={[textStyles.title, styles.topic]}>{vote.topic}</Text>
                {vote.trial ? (
                    <Text style={[textStyles.caption, styles.trialNote]}>
                        Пробный пример: результат не является официальным протоколом ОСС.
                    </Text>
                ) : null}
                <Text style={[textStyles.body, styles.desc]}>{vote.description}</Text>
                {countdown != null && (
                    <Text style={[textStyles.subtitle, styles.timer]}>Осталось: {countdown}</Text>
                )}
                {ended && (
                    <Text style={[textStyles.caption, styles.ended]}>Срок голосования завершён</Text>
                )}
            </Card>

            {!myCast && canVote && (
                <View style={styles.block}>
                    <Text style={[textStyles.label, styles.label]}>
                        Варианты ответа
                    </Text>
                    {vote.options.map((o) => (
                        <View key={o.id} style={styles.btnWrap}>
                            <Button title={o.label} onPress={() => onPick(o.id)} />
                        </View>
                    ))}
                </View>
            )}


            <SectionDivider />

            <View style={styles.block}>
                <Text style={[textStyles.label, styles.label]}>
                    Текущий результат
                </Text>
                <View style={styles.table}>
                    <View style={[styles.tr, styles.trHead]}>
                        <Text style={[textStyles.caption, styles.th, styles.thOption]}>
                            Вариант
                        </Text>
                        <Text style={[textStyles.caption, styles.th, styles.thNum]}>
                            Голоса
                        </Text>
                        <Text style={[textStyles.caption, styles.th, styles.thNum]}>
                            Доля
                        </Text>
                    </View>
                    {vote.options.map((o, rowIndex) => {
                        const row = agg.find((x) => x.optionId === o.id);
                        const cnt = row?.count ?? 0;
                        const pctVotes =
                            totalVotes > 0
                                ? Math.round((cnt / totalVotes) * 1000) / 10
                                : 0;
                        const isLast = rowIndex === vote.options.length - 1;
                        return (
                            <View
                                key={o.id}
                                style={[styles.tr, isLast && styles.trLast]}
                            >
                                <Text style={[textStyles.body, styles.td, styles.tdOption]}>
                                    {o.label}
                                </Text>
                                <Text
                                    style={[textStyles.subtitle, styles.td, styles.tdNum]}
                                >
                                    {cnt}
                                </Text>
                                <Text
                                    style={[textStyles.subtitle, styles.td, styles.tdNum]}
                                >
                                    {totalVotes > 0 ? `${pctVotes}%` : "—"}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            <SectionDivider />

            {vote.visibility === "open" && voteCasts.filter((c) => c.voteId === vote.id).length > 0 && (
                <View style={styles.block}>
                    <Text style={[textStyles.label, styles.label]}>Кто как проголосовал</Text>
                    <View style={styles.table}>
                        <View style={[styles.tr, styles.trHead]}>
                            <Text style={[textStyles.caption, styles.th, { flex: 1 }]}>Участник</Text>
                            <Text style={[textStyles.caption, styles.th, { flex: 1 }]}>Вариант</Text>
                            <Text style={[textStyles.caption, styles.th, styles.thNum]}>Время</Text>
                        </View>
                        {voteCasts
                            .filter((c) => c.voteId === vote.id)
                            .map((c, idx) => {
                                const label = vote.options.find((o) => o.id === c.optionId)?.label ?? "—";
                                const isLast = idx === voteCasts.filter((x) => x.voteId === vote.id).length - 1;
                                const isMe = String(c.userId) === String(user?.id);
                                return (
                                    <View key={`${c.userId}_${c.votedAt}`} style={[styles.tr, isLast && styles.trLast, isMe && styles.trMe]}>
                                        <Text style={[textStyles.caption, styles.td, { flex: 1 }]}>
                                            {isMe ? "Вы" : `…${String(c.userId ?? "").slice(-4)}`}
                                        </Text>
                                        <Text style={[textStyles.caption, styles.td, { flex: 1 }]}>{label}</Text>
                                        <Text style={[textStyles.caption, styles.td, styles.thNum]}>{formatVotedAt(c.votedAt)}</Text>
                                    </View>
                                );
                            })}
                    </View>
                </View>
            )}

            {vote.visibility === "secret" && (
                <Text style={[textStyles.caption, styles.secretNote]}>
                    Тайное голосование: список выборов участников не публикуется, в
                    открытом доступе — только суммарные доли.
                </Text>
            )}

            {ended && (
                <Button
                    title="Скачать протокол (PDF)"
                    variant="secondary"
                    onPress={onPdf}
                />
            )}

            {!isVerifiedResident(verification) && (
                <VerificationWall message="Участвовать в голосовании могут только верифицированные жильцы дома." />
            )}

            {myCast && (
                <View style={styles.votedBanner}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    <Text style={[textStyles.caption, styles.votedMeta]}>
                        Ваш голос зафиксирован · {formatVotedAt(myCast.votedAt)}
                    </Text>
                </View>
            )}
        </ScreenLayout>
    );
}

function formatRemaining(endsAt: string): string {
    const end = new Date(endsAt).getTime();
    const ms = end - Date.now();
    if (ms <= 0) return "0 мин.";
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const minutes = totalMin % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} дн.`);
    if (hours > 0) parts.push(`${hours} ч.`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} мин.`);
    return parts.join(" ");
}

function formatVotedAt(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString("ru-RU", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    miss: { color: colors.textMuted },
    voteCard: { borderLeftWidth: 3, borderLeftColor: colors.accent, gap: spacing.xs },
    cardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.xs,
    },
    typeBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "rgba(212, 168, 83, 0.12)",
    },
    typeBadgeText: { fontSize: 11, fontWeight: "600", color: colors.accent },
    cardDate: { color: colors.textDim, fontSize: 12 },
    sourceTag: { color: colors.primary },
    meta: { color: colors.textDim, marginTop: spacing.xs },
    trialNote: {
        color: colors.accent,
        marginTop: spacing.sm,
        lineHeight: 18,
    },
    topic: { color: colors.text, marginTop: spacing.sm },
    desc: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 },
    timer: { color: colors.primary, marginTop: spacing.md },
    ended: { color: colors.textDim, marginTop: spacing.sm },
    block: { marginTop: spacing.lg, gap: spacing.sm },
    label: { color: colors.textMuted },
    btnWrap: { marginBottom: spacing.sm },
    verifyBlock: { gap: spacing.md, marginTop: spacing.md },
    warn: { color: colors.warning, lineHeight: 20 },
    table: {
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        overflow: "hidden",
        backgroundColor: colors.surface,
    },
    tr: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    trHead: {
        backgroundColor: colors.bgElevated,
        borderBottomColor: colors.border,
    },
    trLast: { borderBottomWidth: 0 },
    th: { color: colors.textDim, fontWeight: "600" },
    thOption: { flex: 1 },
    thNum: { width: 56, textAlign: "right" },
    td: { color: colors.text },
    tdOption: { flex: 1, paddingRight: spacing.sm },
    tdNum: { width: 56, textAlign: "right", color: colors.text },
    divider: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: spacing.lg,
        marginVertical: spacing.sm,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border, opacity: 0.5 },
    dividerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border, marginHorizontal: spacing.md },
    openRow: { color: colors.textMuted, marginTop: spacing.xs },
    secretNote: { color: colors.textDim, marginTop: spacing.md, lineHeight: 20 },
    trMe: { backgroundColor: `${colors.primary}14` },
    votedBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: `${colors.primary}14`,
        borderWidth: 1,
        borderColor: `${colors.primary}33`,
    },
    votedMeta: { color: colors.primary, flex: 1 },
});
