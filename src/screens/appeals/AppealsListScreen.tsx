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
import { AppealStatusBadge, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type {
    AppealsStackParamList,
    MainTabNavigationProp,
} from "../../navigation/types";
import { buildBuildingKey } from "../../utils/buildingKey";
import { colors, radius, spacing, textStyles } from "../../theme";
import { isArchivedAppeal } from "../../utils/appeals";
import type { NeighborAd, Vote } from "../../types";
import { voteSourceLine } from "../../utils/voteSponsor";

type Nav = NativeStackNavigationProp<AppealsStackParamList>;
type CommunityTab = "appeals" | "collective" | "votes" | "ads";

const COMMUNITY_TABS: { id: CommunityTab; label: string }[] = [
    { id: "appeals", label: "Обращения" },
    { id: "collective", label: "Коллективные обращения" },
    { id: "votes", label: "Голосования" },
    { id: "ads", label: "Мои объявления" },
];

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
        () =>
            activeAppeals.filter(
                (a) => a.kind === "collective" && a.buildingKey === houseKey,
            ),
        [activeAppeals, houseKey],
    );

    const myVoteLabel = useMemo(() => {
        const namePart = profile.name?.trim();
        const apt = profile.apartment || "—";
        return namePart ? `${namePart}, кв. ${apt}` : `Кв. ${apt}`;
    }, [profile.name, profile.apartment]);

    const myVotes = useMemo(() => {
        if (!user) return [];
        return votes.filter(
            (v) =>
                v.buildingKey.toLowerCase() === bkLower &&
                v.sponsor === "residents" &&
                v.createdByLabel === myVoteLabel,
        );
    }, [votes, bkLower, user, myVoteLabel]);

    const myAds = useMemo(() => {
        if (!uid) return [];
        return neighborAds.filter(
            (a) =>
                a.authorUserId === uid &&
                a.buildingKey.toLowerCase() === bkLower &&
                !a.archived,
        );
    }, [neighborAds, bkLower, uid]);

    return (
        <ScreenLayout
            title="Сообщество"
            scroll={false}
            contentStyle={styles.flex}
            rightAccessory={
                <Pressable
                    onPress={() => {
                        const parent =
                            navigation.getParent<MainTabNavigationProp>();
                        parent?.navigate("Profile");
                    }}
                    hitSlop={10}
                    style={({ pressed }) => [
                        styles.profileButton,
                        pressed && styles.profileButtonPressed,
                    ]}
                >
                    <Ionicons
                        name="person-circle-outline"
                        size={30}
                        color={colors.text}
                    />
                </Pressable>
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
                            <Text
                                style={[
                                    textStyles.caption,
                                    tab === t.id ? styles.tabTextOn : styles.tabText,
                                ]}
                            >
                                {t.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
            <View style={styles.content}>
                {tab === "appeals" || tab === "collective" ? (
                    <FlatList
                        data={tab === "appeals" ? personalAppeals : collectiveAppeals}
                        keyExtractor={(i) => i.id}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <Text style={[textStyles.body, styles.empty]}>
                                {tab === "appeals"
                                    ? "Пока нет обращений."
                                    : "Нет коллективных обращений по вашему дому."}
                            </Text>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("AppealDetail", {
                                        id: item.id,
                                    })
                                }
                            >
                                <Card style={styles.row}>
                                    <View style={styles.rowTop}>
                                        <View style={styles.badges}>
                                            <AppealStatusBadge status={item.status} />
                                            {item.kind === "collective" && (
                                                <Text
                                                    style={[
                                                        textStyles.caption,
                                                        styles.colBadge,
                                                    ]}
                                                >
                                                    Коллективное
                                                </Text>
                                            )}
                                        </View>
                                        <Text style={[textStyles.caption, styles.date]}>
                                            {formatDate(item.createdAt)}
                                        </Text>
                                    </View>
                                    <Text style={[textStyles.subtitle, styles.title]}>
                                        {item.title}
                                    </Text>
                                    <Text style={[textStyles.caption, styles.category]}>
                                        {item.category}
                                    </Text>
                                </Card>
                            </Pressable>
                        )}
                    />
                ) : null}

                {tab === "votes" ? (
                    <FlatList
                        data={myVotes}
                        keyExtractor={(i) => String(i.id)}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <Text style={[textStyles.body, styles.empty]}>
                                Вы ещё не создавали голосований.
                            </Text>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("VoteDetail", {
                                        id: String(item.id),
                                    })
                                }
                            >
                                <VoteRow vote={item} />
                            </Pressable>
                        )}
                    />
                ) : null}

                {tab === "ads" ? (
                    <FlatList
                        data={myAds}
                        keyExtractor={(i) => String(i.id)}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <Text style={[textStyles.body, styles.empty]}>
                                Вы ещё не публиковали объявления.
                            </Text>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() =>
                                    navigation.navigate("NeighborAdDetail", {
                                        id: String(item.id),
                                    })
                                }
                            >
                                <AdRow ad={item} />
                            </Pressable>
                        )}
                    />
                ) : null}
                <Pressable
                    onPress={() => {
                        if (tab === "appeals") {
                            navigation.navigate("AppealNew");
                            return;
                        }
                        if (tab === "collective") {
                            navigation.navigate("AppealNew", {
                                defaultKind: "collective",
                            });
                            return;
                        }
                        if (tab === "votes") {
                            navigation.navigate("VoteNew");
                            return;
                        }
                        navigation.navigate("NeighborAdNew", {
                            presetCategory: "sell",
                        });
                    }}
                    hitSlop={10}
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

function VoteRow({ vote }: { vote: Vote }) {
    const ended = vote.closed || new Date(vote.endsAt).getTime() <= Date.now();
    return (
        <Card style={styles.row}>
            <Text style={[textStyles.caption, styles.meta]}>
                {ended ? "Завершено" : "Идёт"} ·{" "}
                {vote.visibility === "open" ? "открытое" : "тайное"} ·{" "}
                {voteSourceLine(vote)}
            </Text>
            <Text style={[textStyles.subtitle, styles.title]}>{vote.topic}</Text>
            <Text style={[textStyles.caption, styles.category]}>
                {vote.createdByLabel}
            </Text>
        </Card>
    );
}

const adCatRu: Record<NeighborAd["category"], string> = {
    sell: "Продаю",
    buy: "Ищу",
    lost: "Потеряно",
    found: "Найдено",
    service: "Услуга",
    invite: "Приглашаю",
    other: "Другое",
};

function AdRow({ ad }: { ad: NeighborAd }) {
    return (
        <Card style={styles.row}>
            <Text style={[textStyles.caption, styles.meta]}>
                {adCatRu[ad.category]}
                {ad.pendingModeration ? " · на проверке УК" : ""}
            </Text>
            <Text style={[textStyles.subtitle, styles.title]}>{ad.title}</Text>
            <Text style={[textStyles.caption, styles.category]} numberOfLines={2}>
                {ad.body}
            </Text>
        </Card>
    );
}

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    // Важно: не даём горизонтальному ScrollView "растягиваться" по высоте,
    // иначе он съедает пространство и список визуально уезжает вниз.
    flex: { flex: 1, gap: 0 },
    tabsBar: { marginBottom: spacing.md },
    tabsScroll: { flexGrow: 0, flexShrink: 0 },
    filterRow: {
        flexDirection: "row",
        gap: spacing.sm,
        flexGrow: 0,
        alignItems: "center",
    },
    tab: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignSelf: "flex-start",
    },
    tabOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    tabText: { color: colors.textMuted },
    tabTextOn: { color: colors.primary, fontWeight: "600" },
    content: { flex: 1 },
    profileButton: { marginTop: spacing.xs },
    profileButtonPressed: { opacity: 0.6 },
    list: { gap: spacing.md, paddingBottom: spacing.xxxl * 2 },
    row: { gap: spacing.sm },
    rowTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    badges: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        flex: 1,
        alignItems: "center",
    },
    colBadge: { color: colors.info, fontWeight: "600" },
    date: { color: colors.textDim },
    title: { color: colors.text },
    category: { color: colors.textMuted },
    meta: { color: colors.textDim },
    empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
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
