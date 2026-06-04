import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Dimensions,
    Image,
    Modal,
    Pressable,
    RefreshControl,
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
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, radius, spacing, textStyles } from "../../theme";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

const viewerStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.96)",
        justifyContent: "center",
    },
    page: {
        width: SCREEN_W,
        height: SCREEN_H,
        justifyContent: "center",
        alignItems: "center",
    },
    img: {
        width: SCREEN_W,
        height: SCREEN_H * 0.8,
    },
    closeBtn: {
        position: "absolute",
        top: 52,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
    },
    dots: {
        position: "absolute",
        bottom: 44,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.35)",
    },
    dotActive: {
        backgroundColor: "#fff",
        transform: [{ scale: 1.2 }],
    },
});

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

function FeedDivider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}

export function HomeScreen() {
    const navigation = useNavigation<MainTabNavigationProp>();
    const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
    const [notifOpen, setNotifOpen] = useState(false);
    const [detailNotif, setDetailNotif] = useState<import("../../types").AppNotification | null>(null);
    const {
        news,
        votes,
        neighborAds,
        appeals,
        visibleNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        profile,
        refreshFeed,
    } = useApp();

    const onRefresh = useCallback(() => { void refreshFeed(); }, [refreshFeed]);

    const buildingKey = buildBuildingKey(profile.building);

    const bkLower = buildingKey.toLowerCase();

    const houseNews = useMemo(
        () => news.filter((n) => n.buildingKey.toLowerCase() === bkLower),
        [news, bkLower],
    );

    const houseAds = useMemo(
        () => neighborAds.filter((a) => a.buildingKey.toLowerCase() === bkLower && !a.archived),
        [neighborAds, bkLower],
    );

    const houseVotes = useMemo(
        () => votes.filter((v) => v.buildingKey.toLowerCase() === bkLower),
        [votes, bkLower],
    );

    const houseCollectiveAppeals = useMemo(
        () =>
            appeals.filter(
                (a) =>
                    a.kind === "collective" &&
                    a.buildingKey.toLowerCase() === bkLower &&
                    !isArchivedAppeal(a),
            ),
        [appeals, bkLower],
    );

    const unreadCount = useMemo(
        () => visibleNotifications.filter((n) => !n.read).length,
        [visibleNotifications],
    );

    const feedRows = useMemo(() => {
        const rows: FeedRow[] = [];
        for (const item of houseNews) {
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
        // Важно: единая сортировка по дате (независимо от типа записи).
        return rows.sort((a, b) => b.sortAt - a.sortAt);
    }, [houseNews, houseVotes, houseAds, houseCollectiveAppeals]);

    const visibleFeed = useMemo(() => {
        const filtered = feedRows.filter((row) => {
            if (feedFilter === "all") return true;
            if (feedFilter === "news") return row.kind === "news";
            if (feedFilter === "votes") return row.kind === "vote";
            if (feedFilter === "neighbor") return row.kind === "ad";
            if (feedFilter === "collective") return row.kind === "appeal";
            return true;
        });
        // feedRows уже отсортирован по sortAt, сохраняем порядок.
        return filtered;
    }, [feedRows, feedFilter]);

    const openCommunity = useCallback(
        <S extends keyof CommunityStackParamList>(
            screen: S,
            params?: CommunityStackParamList[S],
        ) => {
            const root = getCommunityRoot(navigation);
            // initial: false — не добавлять initialRoute под целевым экраном
            root?.navigate("Community", { screen, params, initial: false } as never);
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
                            <View style={styles.sheetHeaderRight}>
                                {visibleNotifications.some((n) => !n.read) && (
                                    <Pressable
                                        onPress={markAllNotificationsRead}
                                        hitSlop={10}
                                        style={styles.readAllBtn}
                                    >
                                        <Ionicons name="checkmark-done" size={22} color={colors.primary} />
                                    </Pressable>
                                )}
                                <Pressable
                                    onPress={() => setNotifOpen(false)}
                                    hitSlop={12}
                                    style={styles.sheetClose}
                                >
                                    <Ionicons name="close" size={26} color={colors.text} />
                                </Pressable>
                            </View>
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
                                visibleNotifications.map((n) => (
                                    <NotifRow
                                        key={n.id}
                                        n={n}
                                        onRead={() => markNotificationRead(n.id)}
                                        onOpen={() => { markNotificationRead(n.id); setDetailNotif(n); }}
                                    />
                                ))
                            )}
                        </ScrollView>
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
                    refreshControl={
                        <RefreshControl refreshing={false} onRefresh={onRefresh} />
                    }
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
                        visibleFeed.map((row, index) => (
                            <React.Fragment key={row.key}>
                                {index > 0 && <FeedDivider />}
                                {row.kind === "news" && (
                                    <FeedNewsRow item={row.item} />
                                )}
                                {row.kind === "vote" && (
                                    <FeedVoteRow
                                        vote={row.item}
                                        onOpen={() => openCommunity("VoteDetail", { id: String(row.item.id) })}
                                    />
                                )}
                                {row.kind === "appeal" && (
                                    <FeedAppealRow
                                        appeal={row.item}
                                        onOpen={() => openCommunity("AppealDetail", { id: String(row.item.id) })}
                                    />
                                )}
                                {row.kind === "ad" && (
                                    <FeedAdRow
                                        ad={row.item}
                                        onOpen={() => openCommunity("NeighborAdDetail", { id: String(row.item.id) })}
                                    />
                                )}
                            </React.Fragment>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Детальное уведомление */}
            <Modal
                visible={detailNotif !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setDetailNotif(null)}
            >
                <Pressable style={styles.sheetBackdrop} onPress={() => setDetailNotif(null)}>
                    <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
                        {detailNotif && (() => {
                            const m = typeMeta[detailNotif.type] ?? typeMeta.general;
                            return (
                                <>
                                    <View style={styles.sheetHeader}>
                                        <View style={[styles.tag, { backgroundColor: `${m.color}28` }]}>
                                            <Text style={[textStyles.caption, { color: m.color }]}>{m.label}</Text>
                                        </View>
                                        <Pressable onPress={() => setDetailNotif(null)} hitSlop={12}>
                                            <Ionicons name="close" size={26} color={colors.text} />
                                        </Pressable>
                                    </View>
                                    <Text style={[textStyles.caption, styles.date]}>{formatDate(detailNotif.date)}</Text>
                                    <Text style={[textStyles.subtitle, styles.ntitle]}>{detailNotif.title}</Text>
                                    <Text style={[textStyles.body, { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 }]}>
                                        {detailNotif.body}
                                    </Text>
                                </>
                            );
                        })()}
                    </Pressable>
                </Pressable>
            </Modal>
        </ScreenLayout>
    );
}

function NotifRow({
    n,
    onRead,
    onOpen,
}: {
    n: import("../../types").AppNotification;
    onRead: () => void;
    onOpen: () => void;
}) {
    const lastTap = useRef<number>(0);
    const m = typeMeta[n.type] ?? typeMeta.general;

    const handlePress = () => {
        const now = Date.now();
        if (now - lastTap.current < 350) {
            onOpen(); // двойной тап → открыть детали + пометить прочитанным
        }
        // одиночный тап — ничего не делаем
        lastTap.current = now;
    };

    return (
        <Pressable onPress={handlePress}>
            <Card style={[styles.notifCard, !n.read && styles.notifUnread]} padded>
                <View style={styles.notifTop}>
                    <View style={[styles.tag, { backgroundColor: `${m.color}28` }]}>
                        <Text style={[textStyles.caption, { color: m.color }]}>{m.label}</Text>
                    </View>
                    <Text style={[textStyles.caption, styles.date]}>{formatDate(n.date)}</Text>
                </View>
                <Text style={[textStyles.subtitle, styles.ntitle]}>{n.title}</Text>
                <Text style={[textStyles.caption, styles.nbody]}>{n.body}</Text>
                <View style={styles.notifCheckRow}>
                    <Ionicons
                        name={n.read ? "checkmark-done" : "checkmark"}
                        size={16}
                        color={n.read ? colors.primary : colors.textDim}
                    />
                </View>
            </Card>
        </Pressable>
    );
}

function parseNewsSort(dateStr: string): number {
    // Поддерживаем:
    // - ISO: 2026-04-01T09:00:00
    // - Дату: 2026-04-01
    // - Дату: 01.04.2026 (и опционально время)
    const raw = (dateStr ?? "").trim();
    if (!raw) return 0;

    // YYYY-MM-DD → ставим полдень, чтобы не было смещений по TZ при отображении.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const t = Date.parse(`${raw}T12:00:00`);
        return Number.isNaN(t) ? 0 : t;
    }

    // DD.MM.YYYY or DD.MM.YYYY HH:MM
    const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
    if (m) {
        const dd = Number(m[1]);
        const mm = Number(m[2]);
        const yyyy = Number(m[3]);
        const hh = m[4] ? Number(m[4]) : 12;
        const min = m[5] ? Number(m[5]) : 0;
        const dt = new Date(yyyy, mm - 1, dd, hh, min, 0, 0);
        const t = dt.getTime();
        return Number.isNaN(t) ? 0 : t;
    }

    const t = Date.parse(raw);
    return Number.isNaN(t) ? 0 : t;
}

function PhotoViewer({
    urls,
    initialIndex,
    visible,
    onClose,
}: {
    urls: string[];
    initialIndex: number;
    visible: boolean;
    onClose: () => void;
}) {
    const scrollRef = useRef<ScrollView>(null);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (!visible) return;
        setCurrentIndex(initialIndex);
        const t = setTimeout(() => {
            scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_W, animated: false });
        }, 50);
        return () => clearTimeout(t);
    }, [visible, initialIndex]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={viewerStyles.backdrop}>
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => {
                        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                        setCurrentIndex(idx);
                    }}
                >
                    {urls.map((url, i) => (
                        <View key={i} style={viewerStyles.page}>
                            <Image
                                source={{ uri: url }}
                                style={viewerStyles.img}
                                resizeMode="contain"
                            />
                        </View>
                    ))}
                </ScrollView>

                <Pressable style={viewerStyles.closeBtn} onPress={onClose} hitSlop={16}>
                    <Ionicons name="close" size={28} color="#fff" />
                </Pressable>

                {urls.length > 1 && (
                    <View style={viewerStyles.dots}>
                        {urls.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    viewerStyles.dot,
                                    i === currentIndex && viewerStyles.dotActive,
                                ]}
                            />
                        ))}
                    </View>
                )}
            </View>
        </Modal>
    );
}

function NewsImage({
    uri,
    style,
    onPress,
}: {
    uri: string;
    style: object;
    onPress?: () => void;
}) {
    const [failed, setFailed] = React.useState(false);
    if (failed) return null;
    const img = (
        <Image
            source={{ uri }}
            style={style}
            resizeMode="cover"
            onError={() => setFailed(true)}
        />
    );
    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
                {img}
            </Pressable>
        );
    }
    return img;
}

function FeedNewsRow({ item }: { item: NewsItem }) {
    const multi = item.imageUrls.length > 1;
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const openViewer = (i: number) => { setViewerIndex(i); setViewerVisible(true); };

    return (
        <Card style={[styles.feedCard, styles.feedCardNews]} padded>
            <PhotoViewer
                urls={item.imageUrls}
                initialIndex={viewerIndex}
                visible={viewerVisible}
                onClose={() => setViewerVisible(false)}
            />
            <View style={styles.cardTop}>
                <View style={[styles.typeBadge, styles.typeBadgeNews]}>
                    <Text style={[styles.typeBadgeText, { color: colors.info }]}>Новости УК</Text>
                </View>
                <Text style={styles.cardDate}>{formatNewsDate(item.date)}</Text>
            </View>
            {item.imageUrls.length > 0 ? (
                multi ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.newsImgScroll}
                        contentContainerStyle={styles.newsImgScrollContent}
                        nestedScrollEnabled
                    >
                        {item.imageUrls.map((url, i) => (
                            <NewsImage key={i} uri={url} style={styles.newsImgThumb} onPress={() => openViewer(i)} />
                        ))}
                    </ScrollView>
                ) : (
                    <NewsImage uri={item.imageUrls[0]} style={styles.newsImg} onPress={() => openViewer(0)} />
                )
            ) : null}
            <Text style={[textStyles.subtitle, styles.feedTitle]}>{item.title}</Text>
            <Text style={[textStyles.body, styles.feedExcerpt]}>{item.excerpt}</Text>
        </Card>
    );
}

function FeedAppealRow({ appeal, onOpen }: { appeal: Appeal; onOpen: () => void }) {
    return (
        <Pressable onPress={onOpen}>
            <Card style={[styles.feedCard, styles.feedCardAppeal]} padded>
                <View style={styles.cardTop}>
                    <View style={[styles.typeBadge, styles.typeBadgeAppeal]}>
                        <Text style={[styles.typeBadgeText, { color: colors.warning }]}>Коллективное обращение</Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(appeal.createdAt)}</Text>
                </View>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{appeal.title}</Text>
                <Text style={[textStyles.caption, styles.feedExcerpt]} numberOfLines={2}>{appeal.body}</Text>
                <View style={styles.cardBottom}>
                    <AppealStatusBadge status={appeal.status} />
                    {appeal.entrance ? (
                        <Text style={styles.cardMeta}>подъезд {appeal.entrance}</Text>
                    ) : null}
                </View>
            </Card>
        </Pressable>
    );
}

function FeedVoteRow({ vote, onOpen }: { vote: Vote; onOpen: () => void }) {
    const ended = vote.closed || new Date(vote.endsAt).getTime() <= Date.now();
    return (
        <Pressable onPress={onOpen}>
            <Card style={[styles.feedCard, styles.feedCardVote]} padded>
                <View style={styles.cardTop}>
                    <View style={[styles.typeBadge, styles.typeBadgeVote]}>
                        <Text style={[styles.typeBadgeText, { color: colors.accent }]}>Голосование</Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(vote.createdAt)}</Text>
                </View>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{vote.topic}</Text>
                <View style={styles.cardBottom}>
                    <View style={[styles.statusDot, { backgroundColor: ended ? colors.textDim : colors.primary }]} />
                    <Text style={styles.cardMeta} numberOfLines={1}>
                        {ended ? "Завершено" : "Активно"} · {vote.visibility === "open" ? "открытое" : "тайное"} · {vote.createdByLabel}
                    </Text>
                </View>
            </Card>
        </Pressable>
    );
}

function FeedAdRow({ ad, onOpen }: { ad: NeighborAd; onOpen: () => void }) {
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const openViewer = (i: number) => { setViewerIndex(i); setViewerVisible(true); };
    const multi = ad.imageUrls.length > 1;

    return (
        <Pressable onPress={onOpen}>
            <Card style={[styles.feedCard, styles.feedCardAd]} padded>
                <PhotoViewer
                    urls={ad.imageUrls}
                    initialIndex={viewerIndex}
                    visible={viewerVisible}
                    onClose={() => setViewerVisible(false)}
                />
                <View style={styles.cardTop}>
                    <View style={[styles.typeBadge, styles.typeBadgeAd]}>
                        <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                            {adCatRu[ad.category]}
                        </Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(ad.createdAt)}</Text>
                </View>
                {ad.imageUrls.length > 0 ? (
                    multi ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.newsImgScroll}
                            contentContainerStyle={styles.newsImgScrollContent}
                            nestedScrollEnabled
                        >
                            {ad.imageUrls.map((url, i) => (
                                <NewsImage key={i} uri={url} style={styles.newsImgThumb} onPress={() => openViewer(i)} />
                            ))}
                        </ScrollView>
                    ) : (
                        <NewsImage uri={ad.imageUrls[0]} style={styles.newsImg} onPress={() => openViewer(0)} />
                    )
                ) : null}
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{ad.title}</Text>
                <Text style={[textStyles.caption, styles.feedExcerpt]} numberOfLines={2}>{ad.body}</Text>
                {ad.pendingModeration ? (
                    <Text style={[styles.cardMeta, { color: colors.warning, marginTop: 4 }]}>на проверке УК</Text>
                ) : null}
            </Card>
        </Pressable>
    );
}

function fmtDate(d: Date): string {
    return d.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatDate(iso: string) {
    try {
        return fmtDate(new Date(iso));
    } catch {
        return iso;
    }
}

function formatNewsDate(dateStr: string): string {
    try {
        const raw = (dateStr ?? "").trim();
        const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
        if (m) {
            return fmtDate(new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
        }
        return fmtDate(new Date(raw));
    } catch {
        return dateStr;
    }
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    feedColumn: { flex: 1 },
    feedScroll: { flex: 1 },
    feedScrollContent: {
        paddingBottom: spacing.xxxl * 2,
        paddingTop: spacing.sm,
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
    notifUnread: { borderColor: colors.primary, borderWidth: 1 },
    notifCheckRow: { alignItems: "flex-end", marginTop: spacing.xs },
    sheetHeaderRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    readAllBtn: { padding: spacing.xs },
    detailCard: {
        margin: spacing.lg,
        backgroundColor: colors.bgElevated,
        borderRadius: 16,
        padding: spacing.lg,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
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
    feedCard: { gap: spacing.xs },
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
        height: 200,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.border,
    },
    newsImgScroll: { marginBottom: spacing.sm },
    newsImgScrollContent: { gap: spacing.sm },
    newsImgThumb: {
        width: 260,
        height: 180,
        borderRadius: radius.md,
        backgroundColor: colors.border,
    },
    newsDate: { color: colors.textDim },
    newsTitle: { color: colors.text, marginTop: spacing.xs },
    newsExcerpt: { color: colors.textMuted, marginTop: spacing.sm },
    // Новые стили карточек ленты
    feedCardNews: { borderLeftWidth: 3, borderLeftColor: colors.info },
    feedCardVote: { borderLeftWidth: 3, borderLeftColor: colors.accent },
    feedCardAppeal: { borderLeftWidth: 3, borderLeftColor: colors.warning },
    feedCardAd: { borderLeftWidth: 3, borderLeftColor: colors.primary },
    divider: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: spacing.lg,
        marginVertical: spacing.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    dividerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginHorizontal: spacing.md,
    },
    cardTop: {
        flexDirection: "row" as const,
        justifyContent: "space-between" as const,
        alignItems: "center" as const,
        marginBottom: spacing.sm,
    },
    typeBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
    },
    typeBadgeNews: { backgroundColor: "rgba(91, 159, 212, 0.15)" },
    typeBadgeVote: { backgroundColor: "rgba(212, 168, 83, 0.12)" },
    typeBadgeAppeal: { backgroundColor: "rgba(232, 162, 61, 0.12)" },
    typeBadgeAd: { backgroundColor: "rgba(61, 158, 122, 0.12)" },
    typeBadgeText: { fontSize: 11, fontWeight: "600" as const },
    cardDate: { color: colors.textDim, fontSize: 12 },
    cardBottom: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        flexWrap: "wrap" as const,
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    cardMeta: { color: colors.textMuted, fontSize: 13 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
});
