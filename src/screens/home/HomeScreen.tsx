import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { AppealStatusBadge, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type {
    AuthenticatedRootParamList,
    CommunityStackParamList,
    MainTabNavigationProp,
} from "../../navigation/types";
import type { Appeal, NeighborAd, NewsItem, Vote } from "../../types";
import { buildBuildingKey } from "../../utils/buildingKey";
import { isArchivedAppeal } from "../../utils/appeals";
import { voteSourceLine } from "../../utils/voteSponsor";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, radius, spacing, textStyles } from "../../theme";

const typeMeta: Record<string, { label: string; color: string }> = {
    outage: { label: "Отключения", color: colors.warning },
    meeting: { label: "Собрания", color: colors.accent },
    announcement: { label: "Объявления", color: colors.info },
    general: { label: "Общее", color: colors.textMuted },
};

const adCatRu: Record<NeighborAd["category"], string> = {
    sell: "Продаю",
    buy: "Ищу",
    lost: "Потеряно",
    found: "Найдено",
    service: "Услуга",
    invite: "Приглашаю",
    other: "Другое",
};

type FeedFilter = "all" | "news" | "votes" | "neighbor" | "collective";

type FeedRow =
    | { key: string; sortAt: number; kind: "news"; item: NewsItem }
    | { key: string; sortAt: number; kind: "vote"; item: Vote }
    | { key: string; sortAt: number; kind: "ad"; item: NeighborAd }
    | { key: string; sortAt: number; kind: "appeal"; item: Appeal };

const FILTER_CHIPS: { id: FeedFilter; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "news", label: "Новости УК" },
    { id: "votes", label: "Голосования" },
    { id: "collective", label: "Коллективные" },
    { id: "neighbor", label: "Объявления соседей" },
];

type RootNav = NativeStackNavigationProp<AuthenticatedRootParamList>;

function getCommunityRoot(
    navigation: MainTabNavigationProp,
): RootNav | undefined {
    const p1 = navigation.getParent<RootNav>();
    const names = p1?.getState?.().routeNames;
    if (names?.includes("Community") || names?.includes("Main")) {
        return p1;
    }
    return p1?.getParent<RootNav>();
}

export function HomeScreen() {
    const navigation = useNavigation<MainTabNavigationProp>();
    const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
    const [notifOpen, setNotifOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const {
        news,
        votes,
        neighborAds,
        appeals,
        visibleNotifications,
        markNotificationRead,
        profile,
    } = useApp();

    const buildingKey = buildBuildingKey(profile.building);

    const houseAds = useMemo(
        () => neighborAds.filter((a) => a.buildingKey === buildingKey && !a.archived),
        [neighborAds, buildingKey],
    );

    const houseVotes = useMemo(
        () => votes.filter((v) => v.buildingKey === buildingKey),
        [votes, buildingKey],
    );

    const houseCollectiveAppeals = useMemo(
        () =>
            appeals.filter(
                (a) =>
                    a.kind === "collective" &&
                    a.buildingKey === buildingKey &&
                    !isArchivedAppeal(a),
            ),
        [appeals, buildingKey],
    );

    const unreadCount = useMemo(
        () => visibleNotifications.filter((n) => !n.read).length,
        [visibleNotifications],
    );

    const feedRows = useMemo(() => {
        const rows: FeedRow[] = [];
        for (const item of news) {
            const sortAt = parseNewsSort(item.date);
            rows.push({ key: `n-${item.id}`, sortAt, kind: "news", item });
        }
        for (const v of houseVotes) {
            rows.push({
                key: `v-${v.id}`,
                sortAt: Date.parse(v.createdAt) || 0,
                kind: "vote",
                item: v,
            });
        }
        for (const ad of houseAds) {
            rows.push({
                key: `a-${ad.id}`,
                sortAt: Date.parse(ad.createdAt) || 0,
                kind: "ad",
                item: ad,
            });
        }
        for (const ap of houseCollectiveAppeals) {
            rows.push({
                key: `ap-${ap.id}`,
                sortAt: Date.parse(ap.createdAt) || 0,
                kind: "appeal",
                item: ap,
            });
        }
        return rows.sort((a, b) => b.sortAt - a.sortAt);
    }, [news, houseVotes, houseAds, houseCollectiveAppeals]);

    const visibleFeed = useMemo(() => {
        const filtered = feedRows.filter((row) => {
            if (feedFilter === "all") return true;
            if (feedFilter === "news") return row.kind === "news";
            if (feedFilter === "votes") return row.kind === "vote";
            if (feedFilter === "neighbor") return row.kind === "ad";
            if (feedFilter === "collective") return row.kind === "appeal";
            return true;
        });
        return filtered.sort((a, b) => b.sortAt - a.sortAt);
    }, [feedRows, feedFilter]);

    const openCommunity = useCallback(
        <S extends keyof CommunityStackParamList>(
            screen: S,
            params?: CommunityStackParamList[S],
        ) => {
            const root = getCommunityRoot(navigation);
            root?.navigate("Community", { screen, params } as never);
        },
        [navigation],
    );

    return (
        <ScreenLayout
            title="Домовой"
            subtitle={`Здравствуйте, ${profile.name || "сосед"}`}
            scroll={false}
            contentStyle={styles.flex}
            rightAccessory={
                <View style={styles.headerActions}>
                    <Pressable
                        onPress={() => setNotifOpen(true)}
                        hitSlop={10}
                        style={({ pressed }) => [
                            styles.iconBtn,
                            pressed && styles.iconBtnPressed,
                        ]}
                    >
                        <Ionicons
                            name="notifications-outline"
                            size={26}
                            color={colors.text}
                        />
                        {unreadCount > 0 ? (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {unreadCount > 9 ? "9+" : String(unreadCount)}
                                </Text>
                            </View>
                        ) : null}
                    </Pressable>
                    <Pressable
                        onPress={() => navigation.navigate("Profile")}
                        hitSlop={10}
                        style={({ pressed }) => [
                            styles.iconBtn,
                            pressed && styles.iconBtnPressed,
                        ]}
                    >
                        <Ionicons
                            name="person-circle-outline"
                            size={30}
                            color={colors.text}
                        />
                    </Pressable>
                </View>
            }
        >
            <Modal
                visible={notifOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setNotifOpen(false)}
            >
                <Pressable
                    style={styles.sheetBackdrop}
                    onPress={() => setNotifOpen(false)}
                >
                    <Pressable
                        style={styles.notifSheet}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.sheetHeader}>
                            <Text style={[textStyles.subtitle, styles.sheetTitle]}>
                                Уведомления
                            </Text>
                            <Pressable
                                onPress={() => setNotifOpen(false)}
                                hitSlop={12}
                                style={styles.sheetClose}
                            >
                                <Ionicons name="close" size={26} color={colors.text} />
                            </Pressable>
                        </View>
                        <ScrollView
                            style={styles.sheetScroll}
                            showsVerticalScrollIndicator={false}
                        >
                            {visibleNotifications.length === 0 ? (
                                <Text style={[textStyles.body, styles.sheetEmpty]}>
                                    Пока нет уведомлений.
                                </Text>
                            ) : (
                                visibleNotifications.map((n) => {
                                    const m = typeMeta[n.type] ?? typeMeta.general;
                                    return (
                                        <Pressable
                                            key={n.id}
                                            onPress={() => markNotificationRead(n.id)}
                                        >
                                            <Card
                                                style={[
                                                    styles.notifCard,
                                                    !n.read && styles.notifUnread,
                                                ]}
                                                padded
                                            >
                                                <View style={styles.notifTop}>
                                                    <View
                                                        style={[
                                                            styles.tag,
                                                            {
                                                                backgroundColor: `${m.color}28`,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                textStyles.caption,
                                                                { color: m.color },
                                                            ]}
                                                        >
                                                            {m.label}
                                                        </Text>
                                                    </View>
                                                    <Text
                                                        style={[
                                                            textStyles.caption,
                                                            styles.date,
                                                        ]}
                                                    >
                                                        {formatDate(n.date)}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        textStyles.subtitle,
                                                        styles.ntitle,
                                                    ]}
                                                >
                                                    {n.title}
                                                </Text>
                                                <Text
                                                    style={[textStyles.caption, styles.nbody]}
                                                >
                                                    {n.body}
                                                </Text>
                                            </Card>
                                        </Pressable>
                                    );
                                })
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal
                visible={createOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setCreateOpen(false)}
            >
                <Pressable
                    style={styles.sheetBackdrop}
                    onPress={() => setCreateOpen(false)}
                >
                    <Pressable
                        style={styles.createSheet}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.sheetHeader}>
                            <Text style={[textStyles.subtitle, styles.sheetTitle]}>
                                Добавить
                            </Text>
                            <Pressable
                                onPress={() => setCreateOpen(false)}
                                hitSlop={12}
                                style={styles.sheetClose}
                            >
                                <Ionicons name="close" size={26} color={colors.text} />
                            </Pressable>
                        </View>
                        <Pressable
                            style={({ pressed }) => [
                                styles.createRow,
                                pressed && styles.createRowPressed,
                            ]}
                            onPress={() => {
                                setCreateOpen(false);
                                openCommunity("NeighborAdNew", {
                                    presetCategory: "sell",
                                });
                            }}
                        >
                            <Ionicons
                                name="megaphone-outline"
                                size={22}
                                color={colors.primary}
                            />
                            <View style={styles.createRowText}>
                                <Text
                                    style={[textStyles.subtitle, styles.createRowTitle]}
                                >
                                    Объявление соседа
                                </Text>
                                <Text
                                    style={[textStyles.caption, styles.createRowSub]}
                                >
                                    Короткое объявление для соседей по дому
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={colors.textDim}
                            />
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [
                                styles.createRow,
                                pressed && styles.createRowPressed,
                            ]}
                            onPress={() => {
                                setCreateOpen(false);
                                openCommunity("VoteNew");
                            }}
                        >
                            <Ionicons
                                name="bar-chart-outline"
                                size={22}
                                color={colors.accent}
                            />
                            <View style={styles.createRowText}>
                                <Text
                                    style={[textStyles.subtitle, styles.createRowTitle]}
                                >
                                    Голосование
                                </Text>
                                <Text
                                    style={[textStyles.caption, styles.createRowSub]}
                                >
                                    Тема, варианты ответа и срок опроса
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={colors.textDim}
                            />
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            <View style={styles.feedColumn}>
                <ScrollView
                    style={styles.feedScroll}
                    contentContainerStyle={styles.feedScrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                >
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                        nestedScrollEnabled
                    >
                        {FILTER_CHIPS.map((c) => (
                            <Pressable
                                key={c.id}
                                onPress={() => setFeedFilter(c.id)}
                                style={[
                                    styles.filterChip,
                                    feedFilter === c.id && styles.filterChipOn,
                                ]}
                            >
                                <Text
                                    style={[
                                        textStyles.caption,
                                        feedFilter === c.id
                                            ? styles.filterOnText
                                            : styles.filterOffText,
                                    ]}
                                >
                                    {c.label}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    {visibleFeed.length === 0 ? (
                        <Text style={[textStyles.body, styles.empty]}>
                            В этой категории пока пусто.
                        </Text>
                    ) : (
                        visibleFeed.map((row) => {
                            if (row.kind === "news") {
                                return (
                                    <FeedNewsRow
                                        key={row.key}
                                        item={row.item}
                                        showRibbon={feedFilter === "all"}
                                    />
                                );
                            }
                            if (row.kind === "vote") {
                                return (
                                    <FeedVoteRow
                                        key={row.key}
                                        vote={row.item}
                                        showRibbon={feedFilter === "all"}
                                        onOpen={() =>
                                            openCommunity("VoteDetail", {
                                                id: String(row.item.id),
                                            })
                                        }
                                    />
                                );
                            }
                            if (row.kind === "appeal") {
                                return (
                                    <FeedAppealRow
                                        key={row.key}
                                        appeal={row.item}
                                        showRibbon={feedFilter === "all"}
                                        onOpen={() =>
                                            navigation.navigate("Appeals", {
                                                screen: "AppealDetail",
                                                params: { id: String(row.item.id) },
                                            })
                                        }
                                    />
                                );
                            }
                            return (
                                <FeedAdRow
                                    key={row.key}
                                    ad={row.item}
                                    showRibbon={feedFilter === "all"}
                                    onOpen={() =>
                                        openCommunity("NeighborAdDetail", {
                                            id: String(row.item.id),
                                        })
                                    }
                                />
                            );
                        })
                    )}
                </ScrollView>
                <Pressable
                    onPress={() => setCreateOpen(true)}
                    hitSlop={10}
                    accessibilityLabel="Добавить объявление или голосование"
                    style={({ pressed }) => [
                        styles.fab,
                        pressed && styles.fabPressed,
                    ]}
                >
                    <Ionicons name="add" size={28} color={colors.bg} />
                </Pressable>
            </View>
        </ScreenLayout>
    );
}

function parseNewsSort(dateStr: string): number {
    const t = Date.parse(`${dateStr}T12:00:00`);
    return Number.isNaN(t) ? 0 : t;
}

function FeedNewsRow({ item, showRibbon }: { item: NewsItem; showRibbon?: boolean }) {
    return (
        <Card style={styles.newsCard} padded>
            {showRibbon ? (
                <Text style={[textStyles.caption, styles.ribbon]}>Новости УК</Text>
            ) : null}
            <Image source={{ uri: item.imageUrl }} style={styles.newsImg} />
            <Text style={[textStyles.caption, styles.newsDate]}>{item.date}</Text>
            <Text style={[textStyles.subtitle, styles.newsTitle]}>{item.title}</Text>
            <Text style={[textStyles.body, styles.newsExcerpt]}>{item.excerpt}</Text>
        </Card>
    );
}

function FeedAppealRow({
    appeal,
    onOpen,
    showRibbon,
}: {
    appeal: Appeal;
    onOpen: () => void;
    showRibbon?: boolean;
}) {
    return (
        <Pressable onPress={onOpen}>
            <Card style={styles.feedCard} padded>
                {showRibbon ? (
                    <Text style={[textStyles.caption, styles.ribbon]}>
                        Коллективное обращение
                    </Text>
                ) : null}
                <View style={styles.appealTop}>
                    <AppealStatusBadge status={appeal.status} />
                    {appeal.entrance ? (
                        <Text style={[textStyles.caption, styles.feedMeta]}>
                            подъезд {appeal.entrance}
                        </Text>
                    ) : null}
                </View>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{appeal.title}</Text>
                <Text style={[textStyles.caption, styles.feedExcerpt]} numberOfLines={2}>
                    {appeal.body}
                </Text>
            </Card>
        </Pressable>
    );
}

function FeedVoteRow({
    vote,
    onOpen,
    showRibbon,
}: {
    vote: Vote;
    onOpen: () => void;
    showRibbon?: boolean;
}) {
    const ended =
        vote.closed || new Date(vote.endsAt).getTime() <= Date.now();
    return (
        <Pressable onPress={onOpen}>
            <Card style={styles.feedCard} padded>
                {showRibbon ? (
                    <Text style={[textStyles.caption, styles.ribbon]}>
                        Голосование · {voteSourceLine(vote)}
                    </Text>
                ) : null}
                <Text style={[textStyles.caption, styles.feedMeta]}>
                    {ended ? "Завершено" : "Идёт"} ·{" "}
                    {vote.visibility === "open" ? "открытое" : "тайное"}
                    {!showRibbon ? ` · ${voteSourceLine(vote)}` : ""}
                </Text>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{vote.topic}</Text>
                <Text style={[textStyles.caption, styles.feedExcerpt]}>
                    {vote.createdByLabel}
                </Text>
            </Card>
        </Pressable>
    );
}

function FeedAdRow({
    ad,
    onOpen,
    showRibbon,
}: {
    ad: NeighborAd;
    onOpen: () => void;
    showRibbon?: boolean;
}) {
    return (
        <Pressable onPress={onOpen}>
            <Card style={styles.feedCard} padded>
                {showRibbon ? (
                    <Text style={[textStyles.caption, styles.ribbon]}>
                        Объявление соседа
                    </Text>
                ) : null}
                <Text style={[textStyles.caption, styles.feedMeta]}>
                    {adCatRu[ad.category]}
                    {ad.pendingModeration ? " · на проверке УК" : ""}
                </Text>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{ad.title}</Text>
                <Text style={[textStyles.caption, styles.feedExcerpt]} numberOfLines={2}>
                    {ad.body}
                </Text>
            </Card>
        </Pressable>
    );
}

function formatDate(iso: string) {
    try {
        const d = new Date(iso);
        return d.toLocaleString("ru-RU", {
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
    flex: { flex: 1 },
    feedColumn: { flex: 1 },
    feedScroll: { flex: 1 },
    feedScrollContent: {
        paddingBottom: spacing.xxxl * 2,
    },
    fab: {
        position: "absolute",
        right: spacing.lg,
        bottom: spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    fabPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    iconBtn: { position: "relative", padding: 2 },
    iconBtnPressed: { opacity: 0.65 },
    badge: {
        position: "absolute",
        right: -4,
        top: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.danger,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
    },
    badgeText: {
        color: colors.bg,
        fontSize: 10,
        fontWeight: "700",
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: "flex-end",
    },
    notifSheet: {
        maxHeight: "78%",
        backgroundColor: colors.bgElevated,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomWidth: 0,
    },
    createSheet: {
        backgroundColor: colors.bgElevated,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomWidth: 0,
        paddingBottom: spacing.xl,
    },
    createRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    createRowPressed: { opacity: 0.85 },
    createRowText: { flex: 1 },
    createRowTitle: { color: colors.text },
    createRowSub: { color: colors.textMuted, marginTop: 2 },
    sheetHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    sheetTitle: { color: colors.text },
    sheetClose: { padding: spacing.xs },
    sheetScroll: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
    },
    sheetEmpty: { color: colors.textMuted, paddingVertical: spacing.xl },
    notifCard: { gap: spacing.sm, marginBottom: spacing.md },
    notifUnread: {
        borderColor: colors.primary,
        borderWidth: 1,
    },
    notifTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
    date: { color: colors.textDim },
    ntitle: { color: colors.text },
    nbody: { color: colors.textMuted },
    filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 0,
    alignItems: "center",  // ← добавить
},
    filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",  // ← добавить
},
    filterChipOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    filterOnText: { color: colors.primary },
    filterOffText: { color: colors.textMuted },
    ribbon: { color: colors.textDim, marginBottom: spacing.xs },
    empty: { color: colors.textMuted, paddingVertical: spacing.lg },
    feedCard: { gap: spacing.xs, marginBottom: spacing.md },
    feedMeta: { color: colors.textDim },
    feedTitle: { color: colors.text },
    feedExcerpt: { color: colors.textMuted },
    appealTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        flexWrap: "wrap",
    },
    newsCard: { overflow: "hidden", marginBottom: spacing.md },
    newsImg: {
        width: "100%",
        height: 140,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.border,
    },
    newsDate: { color: colors.textDim },
    newsTitle: { color: colors.text, marginTop: spacing.xs },
    newsExcerpt: { color: colors.textMuted, marginTop: spacing.sm },
});
