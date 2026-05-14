import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AppealStatusBadge, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type {
    AppealsStackParamList,
    MainTabNavigationProp,
} from "../../navigation/types";
import { buildBuildingKey } from "../../utils/buildingKey";
import { colors, radius, spacing, textStyles } from "../../theme";
import { isArchivedAppeal } from "../../utils/appeals";

type Nav = NativeStackNavigationProp<AppealsStackParamList>;
type FeedTab = "mine" | "house";

export function AppealsListScreen() {
    const navigation = useNavigation<Nav>();
    const { appeals, profile, user } = useApp();
    const [tab, setTab] = useState<FeedTab>("mine");
    const houseKey = buildBuildingKey(profile.building);

    const activeAppeals = appeals.filter((item) => !isArchivedAppeal(item));

    const list = useMemo(() => {
        if (!user) return activeAppeals;
        if (tab === "mine") {
            return activeAppeals.filter((a) => a.authorUserId === user.id);
        }
        return activeAppeals.filter(
            (a) =>
                a.kind === "collective" && a.buildingKey === houseKey,
        );
    }, [activeAppeals, tab, user, houseKey]);

    return (
        <ScreenLayout
            title="Обращения"
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
            <View style={styles.tabs}>
                <Pressable
                    onPress={() => setTab("mine")}
                    style={[styles.tab, tab === "mine" && styles.tabOn]}
                >
                    <Text
                        style={[
                            textStyles.caption,
                            tab === "mine" ? styles.tabTextOn : styles.tabText,
                        ]}
                    >
                        Мои
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setTab("house")}
                    style={[styles.tab, tab === "house" && styles.tabOn]}
                >
                    <Text
                        style={[
                            textStyles.caption,
                            tab === "house" ? styles.tabTextOn : styles.tabText,
                        ]}
                    >
                        Коллективные обращения
                    </Text>
                </Pressable>
            </View>
            <View style={styles.content}>
                <FlatList
                    data={list}
                    keyExtractor={(i) => i.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <Text style={[textStyles.body, styles.empty]}>
                            {tab === "mine"
                                ? "Пока нет ваших обращений."
                                : "Нет коллективных обращений по вашему дому."}
                        </Text>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() =>
                                navigation.navigate("AppealDetail", { id: item.id })
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
                                    <Text
                                        style={[textStyles.caption, styles.date]}
                                    >
                                        {formatDate(item.createdAt)}
                                    </Text>
                                </View>
                                <Text
                                    style={[textStyles.subtitle, styles.title]}
                                >
                                    {item.title}
                                </Text>
                                <Text
                                    style={[textStyles.caption, styles.category]}
                                >
                                    {item.category}
                                </Text>
                            </Card>
                        </Pressable>
                    )}
                />
                <Pressable
                    onPress={() => navigation.navigate("AppealNew", tab === "house" ? { defaultKind: "collective" } : undefined)}
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
    flex: { flex: 1 },
    tabs: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    tab: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
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
