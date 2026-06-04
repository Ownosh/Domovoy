import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { AppealStatusBadge, Card, NotificationBell, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type {
    AppealsStackParamList,
    MainTabNavigationProp,
} from "../../navigation/types";
import { buildBuildingKey } from "../../utils/buildingKey";
import { colors, radius, spacing, textStyles } from "../../theme";
import { isArchivedAppeal } from "../../utils/appeals";
import type { Appeal, NeighborAd, Vote } from "../../types";

type Nav = NativeStackNavigationProp<AppealsStackParamList>;
type CommunityTab = "appeals" | "collective" | "votes" | "ads";

const COMMUNITY_TABS: { id: CommunityTab; label: string }[] = [
    { id: "appeals", label: "Мои обращения" },
    { id: "collective", label: "Мои коллективные обращения" },
    { id: "votes", label: "Мои голосования" },
    { id: "ads", label: "Мои объявления" },
];

const adCatRu: Record<NeighborAd["category"], string> = {
    sell: "Продаю", buy: "Ищу", lost: "Потеряно",
    found: "Найдено", service: "Услуга", invite: "Приглашаю", other: "Другое",
};

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString("ru-RU", {
            day: "numeric", month: "short", year: "numeric",
        });
    } catch { return iso; }
}

function Divider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}

function AppealCard({ item, onPress }: { item: Appeal; onPress: () => void }) {
    const isCollective = item.kind === "collective";
    return (
        <Pressable onPress={onPress}>
            <Card style={[styles.feedCard, isCollective ? styles.cardAppeal : styles.cardPersonal]} padded>
                <View style={styles.cardTop}>
                    <View style={[styles.typeBadge, isCollective ? styles.badgeAppeal : styles.badgePersonal]}>
                        <Text style={[styles.typeBadgeText, { color: isCollective ? colors.warning : colors.info }]}>
                            {isCollective ? "Коллективное обращение" : "Обращение"}
                        </Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{item.title}</Text>
                <Text style={[styles.cardMeta, { marginTop: spacing.xs }]} numberOfLines={1}>{item.category}</Text>
                <View style={styles.cardBottom}>
                    <AppealStatusBadge status={item.status} />
                    {item.entrance ? (
                        <Text style={styles.cardMeta}>подъезд {item.entrance}</Text>
                    ) : null}
                </View>
            </Card>
        </Pressable>
    );
}

function VoteCard({ item, onPress }: { item: Vote; onPress: () => void }) {
    const ended = item.closed || new Date(item.endsAt).getTime() <= Date.now();
    return (
        <Pressable onPress={onPress}>
            <Card style={[styles.feedCard, styles.cardVote]} padded>
                <View style={styles.cardTop}>
                    <View style={[styles.typeBadge, styles.badgeVote]}>
                        <Text style={[styles.typeBadgeText, { color: colors.accent }]}>Голосование</Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{item.topic}</Text>
                <View style={styles.cardBottom}>
                    <View style={[styles.statusDot, { backgroundColor: ended ? colors.textDim : colors.primary }]} />
                    <Text style={styles.cardMeta} numberOfLines={1}>
                        {ended ? "Завершено" : "Активно"} · {item.visibility === "open" ? "открытое" : "тайное"}
                    </Text>
                </View>
            </Card>
        </Pressable>
    );
}

function AdCard({ item, onPress }: { item: NeighborAd; onPress: () => void }) {
    const msLeft = new Date(item.expiresAt).getTime() - Date.now();
    const expired = msLeft <= 0;
    return (
        <Pressable onPress={onPress}>
            <Card style={[styles.feedCard, styles.cardAd]} padded>
                <View style={styles.cardTop}>
                    <View style={[styles.typeBadge, styles.badgeAd]}>
                        <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{adCatRu[item.category]}</Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[textStyles.subtitle, styles.feedTitle]}>{item.title}</Text>
                <Text style={styles.cardMeta} numberOfLines={2}>{item.body}</Text>
                <View style={styles.cardBottom}>
                    <View style={[styles.statusDot, { backgroundColor: expired ? colors.danger : msLeft <= 7 * 24 * 60 * 60 * 1000 ? colors.warning : colors.textDim }]} />
                    <Text style={[styles.cardMeta, { color: expired ? colors.danger : msLeft <= 7 * 24 * 60 * 60 * 1000 ? colors.warning : colors.textDim }]}>
                        {expired ? "Истёк" : `до ${new Date(item.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`}
                    </Text>
                    {item.pendingModeration ? (
                        <Text style={[styles.cardMeta, { color: colors.warning }]}>· на проверке</Text>
                    ) : null}
                </View>
            </Card>
        </Pressable>
    );
}

export function AppealsListScreen() {
    const navigation = useNavigation<Nav>();
    const { appeals, profile, user, votes, neighborAds } = useApp();
    const [tab, setTab] = useState<CommunityTab>("appeals");
    const houseKey = buildBuildingKey(profile.building);
    const uid = user ? String(user.id) : null;

    const activeAppeals = appeals.filter((item) => !isArchivedAppeal(item));
    const bkLower = houseKey.toLowerCase();

    const personalAppeals = useMemo(() => {
        if (!user) return activeAppeals.filter((a) => a.kind === "personal");
        return activeAppeals.filter(
            (a) => a.kind === "personal" && a.authorUserId === String(user.id),
        );
    }, [activeAppeals, user]);

    const collectiveAppeals = useMemo(
        () => activeAppeals.filter(
            (a) => a.kind === "collective" && uid !== null && String(a.authorUserId) === String(uid),
        ),
        [activeAppeals, uid],
    );

    const myVoteLabel = useMemo(() => {
        const namePart = profile.name?.trim();
        const apt = profile.apartment || "—";
        return namePart ? `${namePart}, кв. ${apt}` : `Кв. ${apt}`;
    }, [profile.name, profile.apartment]);

    const myVotes = useMemo(() => {
        if (!user) return [];
        return votes.filter(
            (v) => v.buildingKey.toLowerCase() === bkLower && v.sponsor === "residents" && v.createdByLabel === myVoteLabel,
        );
    }, [votes, bkLower, user, myVoteLabel]);

    const myAds = useMemo(() => {
        if (!uid) return [];
        return neighborAds.filter(
            (a) => a.authorUserId === uid && a.buildingKey.toLowerCase() === bkLower && !a.archived,
        );
    }, [neighborAds, bkLower, uid]);

    const currentData = tab === "appeals" ? personalAppeals
        : tab === "collective" ? collectiveAppeals
        : tab === "votes" ? myVotes
        : myAds;

    const emptyText = {
        appeals: "Пока нет обращений.",
        collective: "Нет коллективных обращений.",
        votes: "Вы ещё не создавали голосований.",
        ads: "Вы ещё не публиковали объявления.",
    }[tab];

    return (
        <ScreenLayout
            title="Сообщество"
            scroll={false}
            contentStyle={styles.flex}
            rightAccessory={
                <View style={styles.headerActions}>
                    <NotificationBell />
                    <Pressable
                        onPress={() => navigation.getParent<MainTabNavigationProp>()?.navigate("Profile")}
                        hitSlop={10}
                        style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
                    >
                        <Ionicons name="person-circle-outline" size={30} color={colors.text} />
                    </Pressable>
                </View>
            }
        >
            <View style={styles.tabsBar}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                    style={styles.tabsScroll}
                    nestedScrollEnabled
                >
                    {COMMUNITY_TABS.map((t) => (
                        <Pressable
                            key={t.id}
                            onPress={() => setTab(t.id)}
                            style={[styles.tab, tab === t.id && styles.tabOn]}
                        >
                            <Text style={[textStyles.caption, tab === t.id ? styles.tabTextOn : styles.tabText]}>
                                {t.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.content}>
                <FlatList
                    data={currentData as any[]}
                    keyExtractor={(i) => String(i.id)}
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <Divider />}
                    ListEmptyComponent={
                        <Text style={[textStyles.body, styles.empty]}>{emptyText}</Text>
                    }
                    renderItem={({ item }) => {
                        if (tab === "appeals" || tab === "collective") {
                            return (
                                <AppealCard
                                    item={item as Appeal}
                                    onPress={() => navigation.navigate("AppealDetail", { id: item.id })}
                                />
                            );
                        }
                        if (tab === "votes") {
                            return (
                                <VoteCard
                                    item={item as Vote}
                                    onPress={() => navigation.navigate("VoteDetail", { id: String(item.id) })}
                                />
                            );
                        }
                        return (
                            <AdCard
                                item={item as NeighborAd}
                                onPress={() => navigation.navigate("NeighborAdDetail", { id: String(item.id) })}
                            />
                        );
                    }}
                />
                <Pressable
                    onPress={() => {
                        if (tab === "appeals") { navigation.navigate("AppealNew"); return; }
                        if (tab === "collective") { navigation.navigate("AppealNew", { defaultKind: "collective" }); return; }
                        if (tab === "votes") { navigation.navigate("VoteNew"); return; }
                        navigation.navigate("NeighborAdNew", { presetCategory: "sell" });
                    }}
                    hitSlop={10}
                    style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                >
                    <Ionicons name="add" size={28} color={colors.bg} />
                </Pressable>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    flex: { flex: 1, gap: 0 },
    tabsBar: { marginBottom: spacing.md },
    tabsScroll: { flexGrow: 0, flexShrink: 0 },
    filterRow: { flexDirection: "row", gap: spacing.sm, flexGrow: 0, alignItems: "center" },
    tab: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignSelf: "flex-start",
    },
    tabOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    tabText: { color: colors.textMuted },
    tabTextOn: { color: colors.primary, fontWeight: "600" },
    content: { flex: 1 },
    profileButton: { marginTop: spacing.xs },
    profileButtonPressed: { opacity: 0.6 },
    list: { paddingBottom: spacing.xxxl * 2 },
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
    empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
    // Feed-style cards
    feedCard: { gap: spacing.xs },
    cardPersonal: { borderLeftWidth: 3, borderLeftColor: colors.info },
    cardAppeal: { borderLeftWidth: 3, borderLeftColor: colors.warning },
    cardVote: { borderLeftWidth: 3, borderLeftColor: colors.accent },
    cardAd: { borderLeftWidth: 3, borderLeftColor: colors.primary },
    cardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 },
    typeBadgeText: { fontSize: 11, fontWeight: "600" },
    badgePersonal: { backgroundColor: "rgba(91, 159, 212, 0.15)" },
    badgeAppeal: { backgroundColor: "rgba(232, 162, 61, 0.12)" },
    badgeVote: { backgroundColor: "rgba(212, 168, 83, 0.12)" },
    badgeAd: { backgroundColor: "rgba(61, 158, 122, 0.12)" },
    cardDate: { color: colors.textDim, fontSize: 12 },
    feedTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
    cardBottom: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    cardMeta: { color: colors.textMuted, fontSize: 13 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
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
});
