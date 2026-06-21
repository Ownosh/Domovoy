import { Ionicons } from "@expo/vector-icons";
import type { CommunityScreenProps } from "../../navigation/types";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Button, Card, ScreenLayout, StatusTimeline, VerificationWall, VoteStatusBadge } from "../../components/ui";
import { voteLabels, voteStatusColor } from "../../components/ui/StatusBadge";
import type { TimelineStep } from "../../components/ui/StatusTimeline";
import { voteEffectiveStatus } from "../../utils/appeals";
import { useApp, isVerifiedOwner } from "../../context/AppContext";
import type { Vote, VoteCast, VoteStatus } from "../../types";
import { voteSourceLine } from "../../utils/voteSponsor";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"VoteDetail">;

function useModalBack() {
    const nav = useNavigation();
    const parentRouteNames = nav.getParent()?.getState()?.routeNames;
    const isModal = parentRouteNames?.includes("Main");
    return () => isModal ? nav.getParent()?.goBack() : nav.goBack();
}

function voteEnded(vote: Vote): boolean {
    return Boolean(vote.closed) || new Date(vote.endsAt).getTime() <= Date.now();
}

function aggregate(vote: Vote, casts: VoteCast[]): { optionId: string; count: number }[] {
    const list = casts.filter((c) => c.voteId === vote.id);
    const map = new Map<string, number>();
    for (const o of vote.options) map.set(o.id, 0);
    for (const c of list) map.set(c.optionId, (map.get(c.optionId) ?? 0) + 1);
    return vote.options.map((o) => ({ optionId: o.id, count: map.get(o.id) ?? 0 }));
}

const VOTE_CHAIN: VoteStatus[] = ["new", "under_review", "active", "completed"];
const voteIcons: Partial<Record<VoteStatus, keyof typeof Ionicons.glyphMap>> = {
    new: "radio-button-on-outline",
    under_review: "time-outline",
    active: "people-outline",
    completed: "play-forward-outline",
    cancelled: "close-circle-outline",
};

function getVoteSteps(status: VoteStatus): TimelineStep[] {
    const base = VOTE_CHAIN.includes(status) ? VOTE_CHAIN : [...VOTE_CHAIN, status];
    return base.map((s) => ({ key: s, label: voteLabels[s] ?? s, color: voteStatusColor[s] ?? colors.textMuted, icon: voteIcons[s] }));
}

function formatDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; }
}
function formatDateTime(iso: string): string {
    try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}
function formatRemaining(endsAt: string): string {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return "0 мин.";
    const m = Math.floor(ms / 60000);
    const d = Math.floor(m / (60 * 24));
    const h = Math.floor((m % (60 * 24)) / 60);
    const min = m % 60;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d} дн.`);
    if (h > 0) parts.push(`${h} ч.`);
    if (min > 0 || !parts.length) parts.push(`${min} мин.`);
    return parts.join(" ");
}

export function VoteDetailScreen({ route }: Props) {
    const goBack = useModalBack();
    const { votes, voteCasts, castVote, verification, profile } = useApp();
    const vote = votes.find((v) => v.id === route.params.id);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!vote || voteEnded(vote)) return;
        const t = setInterval(() => setTick((x) => x + 1), 1000);
        return () => clearInterval(t);
    }, [vote]);
    void tick;

    const ended = vote ? voteEnded(vote) : true;
    const activeApartmentId = profile.apartmentId;
    const myCast = vote && activeApartmentId
        ? voteCasts.find(
              (c) => c.voteId === vote.id && c.apartmentId === activeApartmentId,
          )
        : undefined;
    const agg = useMemo(() => vote ? aggregate(vote, voteCasts) : [], [vote, voteCasts]);
    const totalVotes = useMemo(() => agg.reduce((s, a) => s + a.count, 0), [agg]);

    if (!vote) {
        return (
            <ScreenLayout title="Голосование" onBack={goBack}>
                <Text style={[textStyles.body, styles.miss]}>Голосование не найдено</Text>
            </ScreenLayout>
        );
    }

    const voteStatus = voteEffectiveStatus(vote);
    const sc = voteStatusColor[voteStatus] ?? colors.textMuted;
    const canVote = isVerifiedOwner(verification) && !ended && !myCast;
    const myOption = myCast ? vote.options.find((o) => o.id === myCast.optionId) : undefined;
    const myVoteCasts = voteCasts.filter((c) => c.voteId === vote.id);

    const onPick = (optionId: string) => {
        const r = castVote({ voteId: vote.id, optionId });
        if (!r.ok) Alert.alert("Нельзя проголосовать", "reason" in r ? r.reason : "");
    };

    return (
        <ScreenLayout title="Голосование" scroll onBack={goBack}>

            {/* ── Лента статусов ── */}
            <View style={styles.timelineWrap}>
                <StatusTimeline steps={getVoteSteps(voteStatus)} currentKey={voteStatus} />
            </View>

            {/* ── Основная карточка ── */}
            <Card style={[styles.mainCard, { borderLeftColor: sc }]}>
                <View style={styles.topRow}>
                    <VoteStatusBadge status={voteStatus} />
                    <View style={[styles.visBadge, { borderColor: `${sc}44`, backgroundColor: `${sc}0d` }]}>
                        <Ionicons name={vote.visibility === "open" ? "eye-outline" : "eye-off-outline"} size={12} color={sc} />
                        <Text style={[styles.visBadgeText, { color: sc }]}>
                            {vote.visibility === "open" ? "Открытое" : "Тайное"}
                        </Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(vote.createdAt)}</Text>
                </View>

                <Text style={[textStyles.caption, { color: sc, marginTop: spacing.xs }]}>
                    {voteSourceLine(vote)}
                </Text>
                <Text style={[textStyles.title, styles.topic]}>{vote.topic}</Text>
                {vote.description ? (
                    <Text style={[textStyles.body, styles.desc]}>{vote.description}</Text>
                ) : null}

                {/* Таймер / статус */}
                {!ended && (
                    <View style={[styles.timerPill, { backgroundColor: `${sc}18`, borderColor: `${sc}44` }]}>
                        <Ionicons name="time-outline" size={14} color={sc} />
                        <Text style={[styles.timerText, { color: sc }]}>Осталось: {formatRemaining(vote.endsAt)}</Text>
                    </View>
                )}
                {ended && (
                    <View style={[styles.timerPill, { backgroundColor: `${colors.textDim}14`, borderColor: `${colors.textDim}33` }]}>
                        <Ionicons name="checkmark-done-outline" size={14} color={colors.textDim} />
                        <Text style={[styles.timerText, { color: colors.textDim }]}>Голосование завершено</Text>
                    </View>
                )}

                {vote.trial && (
                    <Text style={[textStyles.caption, { color: colors.accent, marginTop: spacing.xs }]}>
                        Пробный пример — не влияет на реальные решения дома
                    </Text>
                )}
            </Card>

            {/* ── Варианты / Результаты (единый блок) ── */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name={canVote ? "hand-left-outline" : "bar-chart-outline"} size={16} color={sc} />
                    <Text style={[textStyles.label, styles.sectionTitle, { color: sc }]}>
                        {canVote
                            ? "Выберите вариант"
                            : `Результаты · ${totalVotes} ${totalVotes === 1 ? "голос" : totalVotes < 5 ? "голоса" : "голосов"}`}
                    </Text>
                </View>
                <View style={styles.optionsList}>
                    {vote.options.map((o) => {
                        const row = agg.find((x) => x.optionId === o.id);
                        const cnt = row?.count ?? 0;
                        const pct = totalVotes > 0 ? cnt / totalVotes : 0;
                        const isMyVote = myCast?.optionId === o.id;
                        const isWinner = ended && cnt > 0 && cnt === Math.max(...agg.map((a) => a.count));

                        if (canVote) {
                            return (
                                <Pressable
                                    key={o.id}
                                    onPress={() => onPick(o.id)}
                                    style={({ pressed }) => [
                                        styles.optionBtn,
                                        { borderColor: pressed ? sc : `${sc}55`, backgroundColor: pressed ? `${sc}1a` : `${sc}08` },
                                    ]}
                                >
                                    <View style={[styles.optionRadio, { borderColor: `${sc}88` }]} />
                                    <Text style={[textStyles.body, styles.optionLabel]}>{o.label}</Text>
                                </Pressable>
                            );
                        }

                        return (
                            <View key={o.id} style={[styles.resultRow, isMyVote && { borderColor: `${sc}44`, backgroundColor: `${sc}07` }]}>
                                <View style={styles.resultTop}>
                                    <View style={styles.resultLabelRow}>
                                        {isWinner && <Ionicons name="trophy-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />}
                                        {isMyVote && !isWinner && <Ionicons name="checkmark-circle" size={13} color={sc} style={{ marginRight: 4 }} />}
                                        <Text style={[textStyles.body, styles.resultLabel, (isWinner || isMyVote) && { fontWeight: "700", color: isMyVote ? sc : colors.text }]}>
                                            {o.label}
                                        </Text>
                                    </View>
                                    <Text style={[textStyles.subtitle, styles.resultPct, { color: pct > 0 ? sc : colors.textDim }]}>
                                        {totalVotes > 0 ? `${Math.round(pct * 100)}%` : "—"}
                                    </Text>
                                </View>
                                <View style={styles.barBg}>
                                    <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: sc, opacity: isMyVote || isWinner ? 1 : 0.45 }]} />
                                </View>
                                <Text style={[textStyles.caption, styles.resultCount]}>{cnt} голосов</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Ваш голос — под результатами */}
                {myCast && myOption && (
                    <View style={[styles.myVoteBanner, { backgroundColor: `${sc}14`, borderColor: `${sc}33` }]}>
                        <Ionicons name="checkmark-circle" size={18} color={sc} />
                        <View style={styles.myVoteInfo}>
                            <Text style={[textStyles.caption, { color: sc, fontWeight: "700" }]}>
                                Ваш голос зафиксирован · {formatDateTime(myCast.votedAt)}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {/* ── Кто как проголосовал (открытое) ── */}
            {vote.visibility === "open" && myVoteCasts.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="people-outline" size={16} color={sc} />
                        <Text style={[textStyles.label, styles.sectionTitle, { color: sc }]}>Проголосовали · {myVoteCasts.length}</Text>
                    </View>
                    <Card style={[styles.castsCard, { borderLeftColor: sc }]}>
                        {myVoteCasts.map((c, idx) => {
                            const label = vote.options.find((o) => o.id === c.optionId)?.label ?? "—";
                            const isMe = c.apartmentId === activeApartmentId;
                            const isLast = idx === myVoteCasts.length - 1;
                            return (
                                <View key={`${c.apartmentId}_${c.votedAt}`} style={[styles.castRow, !isLast && styles.castRowBorder, isMe && { backgroundColor: `${sc}0a` }]}>
                                    <View style={[styles.castAvatar, { backgroundColor: `${sc}18`, borderColor: `${sc}33` }]}>
                                        <Ionicons name="person-outline" size={13} color={sc} />
                                    </View>
                                    <Text style={[textStyles.caption, styles.castUser]}>{isMe ? "Вы" : `Участник …${String(c.userId ?? "").slice(-4)}`}</Text>
                                    <Text style={[textStyles.caption, styles.castChoice, { color: sc }]}>{label}</Text>
                                    <Text style={styles.castTime}>{formatDateTime(c.votedAt)}</Text>
                                </View>
                            );
                        })}
                    </Card>
                </View>
            )}

            {vote.visibility === "secret" && totalVotes > 0 && (
                <View style={[styles.secretBanner, { borderColor: `${colors.textDim}33` }]}>
                    <Ionicons name="eye-off-outline" size={15} color={colors.textDim} />
                    <Text style={[textStyles.caption, { color: colors.textDim, flex: 1 }]}>
                        Тайное голосование — личные выборы участников не публикуются
                    </Text>
                </View>
            )}

            {!isVerifiedResident(verification) && (
                <VerificationWall message="Участвовать могут только верифицированные жильцы." />
            )}

            {ended && (
                <Button title="Скачать протокол (PDF)" variant="secondary" onPress={() => Alert.alert("Протокол PDF", "Функция будет доступна в релизе.")} style={styles.pdfBtn} />
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    miss: { color: colors.textMuted },
    timelineWrap: { marginHorizontal: -spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, marginBottom: spacing.md },

    // Main card
    mainCard: { borderLeftWidth: 3, gap: spacing.sm },
    topRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
    visBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
    visBadgeText: { fontSize: 11, fontWeight: "600" },
    cardDate: { fontSize: 12, color: colors.textDim, marginLeft: "auto" as any },
    topic: { color: colors.text, marginTop: spacing.xs },
    desc: { color: colors.textMuted, lineHeight: 20 },
    timerPill: {
        flexDirection: "row", alignItems: "center", gap: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: 6,
        borderRadius: radius.full, borderWidth: 1,
        alignSelf: "flex-start", marginTop: spacing.sm,
    },
    timerText: { fontSize: 12, fontWeight: "600" },

    // Section
    section: { marginTop: spacing.lg, gap: spacing.sm },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sectionTitle: {},

    // Options
    optionsList: { gap: spacing.sm },
    optionBtn: {
        flexDirection: "row", alignItems: "center",
        borderWidth: 1.5, borderRadius: radius.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
        gap: spacing.md,
    },
    optionRadio: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2, flexShrink: 0,
    },
    optionLabel: { flex: 1, fontWeight: "600", color: colors.text },

    // My vote
    myVoteBanner: {
        flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
        borderRadius: radius.md, borderWidth: 1,
        padding: spacing.md, marginTop: spacing.md,
    },
    myVoteInfo: { flex: 1, gap: 3 },

    // Results
    resultsList: { gap: spacing.sm },
    resultRow: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.md,
        gap: 6,
    },
    resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    resultLabelRow: { flexDirection: "row", alignItems: "center", flex: 1 },
    resultLabel: { color: colors.text, flex: 1 },
    resultPct: { fontSize: 17, fontWeight: "700", marginLeft: spacing.sm },
    barBg: { height: 6, backgroundColor: colors.borderSubtle, borderRadius: 3, overflow: "hidden" },
    barFill: { height: 6, borderRadius: 3 },
    resultCount: { color: colors.textDim },

    // Casts
    castsCard: { borderLeftWidth: 3, gap: 0 },
    castRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    castRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
    castAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    castUser: { color: colors.textMuted, flex: 1 },
    castChoice: { fontWeight: "600", fontSize: 12 },
    castTime: { fontSize: 11, color: colors.textDim },

    // Secret
    secretBanner: {
        flexDirection: "row", alignItems: "center", gap: spacing.sm,
        marginTop: spacing.md, padding: spacing.md,
        borderRadius: radius.md, borderWidth: 1,
    },

    // PDF
    pdfBtn: { marginTop: spacing.md, alignSelf: "center", borderRadius: 999, paddingHorizontal: 28 },
});
