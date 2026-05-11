import type { CommunityScreenProps } from "../../navigation/types";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import type { Vote, VoteCast } from "../../types";
import { voteSourceLine } from "../../utils/voteSponsor";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"VoteDetail">;

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

export function VoteDetailScreen({ route, navigation }: Props) {
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
              (c) => c.voteId === vote.id && c.userId === user?.id,
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
            <ScreenLayout title="Голосование" onBack={() => navigation.goBack()}>
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
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Text style={[textStyles.caption, styles.sourceTag]}>
                    {voteSourceLine(vote)}
                </Text>
                <Text style={[textStyles.caption, styles.meta]}>
                    {vote.visibility === "open" ? "Открытое" : "Тайное"} ·{" "}
                    {vote.createdByLabel}
                </Text>
                <Text style={[textStyles.title, styles.topic]}>{vote.topic}</Text>
                {vote.trial ? (
                    <Text style={[textStyles.caption, styles.trialNote]}>
                        Это пробный пример: результат не является официальным протоколом ОСС.
                    </Text>
                ) : null}
                <Text style={[textStyles.body, styles.desc]}>
                    {vote.description}
                </Text>
                {countdown != null && (
                    <Text style={[textStyles.subtitle, styles.timer]}>
                        Осталось: {countdown}
                    </Text>
                )}
                {ended && (
                    <Text style={[textStyles.caption, styles.ended]}>
                        Срок голосования завершён
                    </Text>
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

            {myCast && (
                <Text style={[textStyles.caption, styles.votedMeta]}>
                    Ваш голос зафиксирован: {formatVotedAt(myCast.votedAt)}
                </Text>
            )}

            {!isVerifiedResident(verification) && (
                <Text style={[textStyles.caption, styles.warn]}>
                    Участвовать в опросе дома могут жильцы с подтверждённой верификацией.
                    Официальное ОСС оформляется отдельно (ГИС ЖКХ, УК).
                </Text>
            )}

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

            {vote.visibility === "open" && (
                <View style={styles.block}>
                    <Text style={[textStyles.label, styles.label]}>
                        Кто как проголосовал
                    </Text>
                    {voteCasts
                        .filter((c) => c.voteId === vote.id)
                        .map((c) => {
                            const label = vote.options.find(
                                (o) => o.id === c.optionId,
                            )?.label;
                            return (
                                <Text
                                    key={`${c.userId}_${c.votedAt}`}
                                    style={[textStyles.caption, styles.openRow]}
                                >
                                    Участник …{c.userId.slice(-4)} → {label} ·{" "}
                                    {formatVotedAt(c.votedAt)}
                                </Text>
                            );
                        })}
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
    votedMeta: { color: colors.primary, marginTop: spacing.lg },
    warn: { color: colors.warning, marginTop: spacing.md, lineHeight: 20 },
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
    openRow: { color: colors.textMuted, marginTop: spacing.xs },
    secretNote: { color: colors.textDim, marginTop: spacing.md, lineHeight: 20 },
});
