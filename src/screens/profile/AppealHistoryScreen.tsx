import type { ProfileScreenProps, ProfileStackParamList } from "../../navigation/types";
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
import {
    AppealStatusBadge,
    AdStatusBadge,
    VoteStatusBadge,
    Card,
    ScreenLayout,
} from "../../components/ui";
import {
    adEffectiveStatus,
    adStatusColor,
    isArchivedAppeal,
    isArchivedNeighborAd,
    isArchivedVote,
    voteEffectiveStatus,
    userInCollectiveAppeal,
    userParticipatedInVote,
} from "../../utils/appeals";
import { voteStatusColor } from "../../components/ui/StatusBadge";
import { APPEAL_CATEGORY_LABELS, appealCategoryOptions } from "../../constants/appealCategories";
import { useApp } from "../../context/AppContext";
import { buildBuildingKey } from "../../utils/buildingKey";
import type { Appeal, NeighborAd, NeighborAdCategory, Vote, VoteVisibility } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"AppealHistory">;
type Nav = NativeStackNavigationProp<ProfileStackParamList, "AppealHistory">;

type ArchiveTab = "appeals" | "collective" | "votes" | "ads";

const ARCHIVE_TABS: { id: ArchiveTab; label: string }[] = [
    { id: "appeals", label: "Мои обращения" },
    { id: "collective", label: "Коллективные" },
    { id: "votes", label: "Голосования" },
    { id: "ads", label: "Объявления" },
];

const adCatRu: Record<NeighborAdCategory, string> = {
    sell: "Продаю",
    buy: "Ищу",
    lost: "Потеряно",
    found: "Найдено",
    service: "Услуга",
    invite: "Приглашаю",
    other: "Другое",
};

const adCategoryFilters: { key: NeighborAdCategory | "all"; label: string }[] = [
    { key: "all", label: "Все" },
    ...(["sell", "buy", "service", "invite", "lost", "found", "other"] as NeighborAdCategory[]).map((key) => ({
        key,
        label: adCatRu[key],
    })),
];

const voteVisibilityFilters: { key: VoteVisibility | "all"; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "open", label: "Открытые" },
    { key: "secret", label: "Тайные" },
];

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

function categoryLabel(item: Appeal): string {
    return (
        item.categoryLabel ??
        APPEAL_CATEGORY_LABELS[item.category as keyof typeof APPEAL_CATEGORY_LABELS] ??
        item.category
    );
}

export function AppealHistoryScreen({ navigation }: Props) {
    const nav = navigation as unknown as Nav;
    const { appeals, neighborAds, votes, voteCasts, profile, user } = useApp();
    const [tab, setTab] = useState<ArchiveTab>("appeals");
    const [appealCategory, setAppealCategory] = useState<string | "all">("all");
    const [voteVisibility, setVoteVisibility] = useState<VoteVisibility | "all">("all");
    const [adCategory, setAdCategory] = useState<NeighborAdCategory | "all">("all");

    const houseKey = buildBuildingKey(profile.building);
    const bkLower = houseKey.toLowerCase();
    const uid = user ? String(user.id) : null;

    const archivedPersonalAppeals = useMemo(() => {
        if (!uid) return [];
        let list = appeals.filter(
            (a) => a.kind === "personal" && String(a.authorUserId) === uid && isArchivedAppeal(a),
        );
        if (appealCategory !== "all") {
            list = list.filter((a) => a.category === appealCategory);
        }
        return list;
    }, [appeals, appealCategory, uid]);

    const archivedCollectiveAppeals = useMemo(() => {
        if (!uid) return [];
        let list = appeals.filter(
            (a) => a.kind === "collective" && isArchivedAppeal(a) && userInCollectiveAppeal(a, uid),
        );
        if (appealCategory !== "all") {
            list = list.filter((a) => a.category === appealCategory);
        }
        return list;
    }, [appeals, appealCategory, uid]);

    const archivedVotes = useMemo(() => {
        if (!uid) return [];
        let list = votes.filter(
            (v) =>
                v.buildingKey.toLowerCase() === bkLower &&
                isArchivedVote(v) &&
                (v.userId === uid || userParticipatedInVote(v.id, voteCasts, uid)),
        );
        if (voteVisibility !== "all") {
            list = list.filter((v) => v.visibility === voteVisibility);
        }
        return list;
    }, [votes, voteCasts, bkLower, uid, voteVisibility]);

    const archivedAds = useMemo(() => {
        if (!uid) return [];
        let list = neighborAds.filter(
            (a) =>
                a.authorUserId === uid &&
                a.buildingKey.toLowerCase() === bkLower &&
                isArchivedNeighborAd(a),
        );
        if (adCategory !== "all") {
            list = list.filter((a) => a.category === adCategory);
        }
        return list;
    }, [neighborAds, uid, bkLower, adCategory]);

    const categoryFilters =
        tab === "appeals" || tab === "collective"
            ? [{ key: "all" as const, label: "Все" }, ...appealCategoryOptions.map((o) => ({ key: o.key, label: o.label }))]
            : tab === "votes"
              ? voteVisibilityFilters
              : adCategoryFilters;

    const activeFilter =
        tab === "appeals" || tab === "collective"
            ? appealCategory
            : tab === "votes"
              ? voteVisibility
              : adCategory;

    const setActiveFilter = (key: string) => {
        if (tab === "appeals" || tab === "collective") {
            setAppealCategory(key);
        } else if (tab === "votes") {
            setVoteVisibility(key as VoteVisibility | "all");
        } else {
            setAdCategory(key as NeighborAdCategory | "all");
        }
    };

    const onTabChange = (id: ArchiveTab) => {
        setTab(id);
        setAppealCategory("all");
        setVoteVisibility("all");
        setAdCategory("all");
    };

    const emptyText = {
        appeals: "В архиве пока нет завершённых личных обращений",
        collective: "В архиве пока нет завершённых коллективных обращений, где вы автор или участник",
        votes: "В архиве пока нет завершённых голосований, где вы автор или проголосовали",
        ads: "В архиве пока нет ваших объявлений",
    }[tab];

    const listData =
        tab === "appeals"
            ? archivedPersonalAppeals
            : tab === "collective"
              ? archivedCollectiveAppeals
              : tab === "votes"
                ? archivedVotes
                : archivedAds;

    return (
        <ScreenLayout
            title="Архив"
            subtitle="Завершённые обращения, голосования и объявления"
            scroll={false}
            contentStyle={styles.flex}
            onBack={() => navigation.goBack()}
        >
            <View style={styles.tabsBar}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    {ARCHIVE_TABS.map((t) => (
                        <Pressable
                            key={t.id}
                            onPress={() => onTabChange(t.id)}
                            style={[styles.tab, tab === t.id && styles.tabOn]}
                        >
                            <Text style={[textStyles.caption, tab === t.id ? styles.tabTextOn : styles.tabText]}>
                                {t.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.tabsBar}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    {categoryFilters.map((c) => (
                        <Pressable
                            key={c.key}
                            onPress={() => setActiveFilter(c.key)}
                            style={[styles.chip, activeFilter === c.key && styles.chipOn]}
                        >
                            <Text
                                style={[
                                    textStyles.caption,
                                    activeFilter === c.key ? styles.chipTextOn : styles.chipText,
                                ]}
                                numberOfLines={1}
                            >
                                {c.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={listData as (Appeal | Vote | NeighborAd)[]}
                keyExtractor={(i) => String(i.id)}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={[textStyles.body, styles.empty]}>{emptyText}</Text>
                }
                renderItem={({ item }) => {
                    if (tab === "appeals" || tab === "collective") {
                        const appeal = item as Appeal;
                        return (
                            <Pressable onPress={() => nav.navigate("AppealHistoryDetail", { id: appeal.id })}>
                                <Card style={styles.row}>
                                    <View style={styles.rowTop}>
                                        <AppealStatusBadge status={appeal.status} />
                                        <Text style={[textStyles.caption, styles.date]}>
                                            {formatDate(appeal.createdAt)}
                                        </Text>
                                    </View>
                                    <Text style={[textStyles.subtitle, styles.title]}>{appeal.title}</Text>
                                    <Text style={[textStyles.caption, styles.cat]}>{categoryLabel(appeal)}</Text>
                                </Card>
                            </Pressable>
                        );
                    }

                    if (tab === "votes") {
                        const vote = item as Vote;
                        const status = voteEffectiveStatus(vote);
                        const statusColor = voteStatusColor[status] ?? colors.textMuted;
                        return (
                            <Pressable onPress={() => nav.navigate("VoteDetail", { id: String(vote.id) })}>
                                <Card style={[styles.row, { borderLeftWidth: 3, borderLeftColor: statusColor }]}>
                                    <View style={styles.rowTop}>
                                        <View style={[styles.typeBadge, { backgroundColor: `${statusColor}18` }]}>
                                            <Text style={[styles.typeBadgeText, { color: statusColor }]}>
                                                Голосование
                                            </Text>
                                        </View>
                                        <Text style={[textStyles.caption, styles.date]}>
                                            {formatDate(vote.createdAt)}
                                        </Text>
                                    </View>
                                    <Text style={[textStyles.subtitle, styles.title]}>{vote.topic}</Text>
                                    <View style={styles.adBottom}>
                                        <VoteStatusBadge status={status} />
                                        <Text style={[textStyles.caption, styles.cat]}>
                                            {vote.visibility === "open" ? "открытое" : "тайное"}
                                        </Text>
                                    </View>
                                </Card>
                            </Pressable>
                        );
                    }

                    const ad = item as NeighborAd;
                    const status = adEffectiveStatus(ad);
                    const statusColor = adStatusColor[status] ?? colors.textMuted;
                    return (
                        <Pressable onPress={() => nav.navigate("NeighborAdDetail", { id: ad.id })}>
                            <Card style={[styles.row, { borderLeftWidth: 3, borderLeftColor: statusColor }]}>
                                <View style={styles.rowTop}>
                                    <View style={[styles.typeBadge, { backgroundColor: `${statusColor}18` }]}>
                                        <Text style={[styles.typeBadgeText, { color: statusColor }]}>
                                            {adCatRu[ad.category]}
                                        </Text>
                                    </View>
                                    <Text style={[textStyles.caption, styles.date]}>
                                        {formatDate(ad.createdAt)}
                                    </Text>
                                </View>
                                <Text style={[textStyles.subtitle, styles.title]}>{ad.title}</Text>
                                <Text style={[textStyles.caption, styles.cat]} numberOfLines={2}>
                                    {ad.body}
                                </Text>
                                <View style={styles.adBottom}>
                                    <AdStatusBadge status={status} />
                                </View>
                            </Card>
                        </Pressable>
                    );
                }}
            />
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    tabsBar: { marginBottom: spacing.sm },
    filterRow: { flexDirection: "row", gap: spacing.sm, paddingBottom: spacing.xs },
    tab: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    tabOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    tabText: { color: colors.textMuted },
    tabTextOn: { color: colors.primary, fontWeight: "600" },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    chipText: { color: colors.textMuted },
    chipTextOn: { color: colors.primary, fontWeight: "600" },
    list: { gap: spacing.md, paddingBottom: spacing.xxxl },
    row: { gap: spacing.sm },
    rowTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 },
    typeBadgeText: { fontSize: 11, fontWeight: "600" },
    date: { color: colors.textDim },
    title: { color: colors.text },
    cat: { color: colors.textMuted },
    adBottom: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
