import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, NotificationBell, ScreenLayout } from "../../components/ui";
import type { MainTabNavigationProp, SafetyStackParamList } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Nav = NativeStackNavigationProp<SafetyStackParamList>;

type SafetyTab = "quick" | "rights";

const SAFETY_TABS: { id: SafetyTab; label: string }[] = [
    { id: "quick", label: "Экстренно" },
    { id: "rights", label: "Права и обязанности" },
];

function Divider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}

export function SafetyHubScreen() {
    const tabNav = useNavigation<MainTabNavigationProp>();
    const nav = useNavigation<Nav>();
    const [tab, setTab] = useState<SafetyTab>("quick");

    return (
        <ScreenLayout
            title="Памятка"
            rightAccessory={
                <View style={styles.headerActions}>
                    <NotificationBell />
                    <Pressable
                        onPress={() => tabNav.navigate("Profile")}
                        hitSlop={10}
                        style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
                    >
                        <Ionicons name="person-circle-outline" size={30} color={colors.text} />
                    </Pressable>
                </View>
            }
        >
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                nestedScrollEnabled
            >
                {SAFETY_TABS.map((t) => (
                    <Pressable
                        key={t.id}
                        onPress={() => setTab(t.id)}
                        style={[styles.filterChip, tab === t.id && styles.filterChipOn]}
                    >
                        <Text
                            style={[
                                textStyles.caption,
                                tab === t.id ? styles.filterOnText : styles.filterOffText,
                            ]}
                        >
                            {t.label}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            {tab === "quick" ? (
                <View style={styles.itemList}>
                    <Pressable
                        onPress={() => nav.navigate("EmergencyGuide")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={[styles.cardInner, styles.cardGuide]} padded>
                            <View style={styles.cardTop}>
                                <View style={[styles.badge, styles.badgeGuide]}>
                                    <Text style={[styles.badgeText, { color: colors.warning }]}>ЧС и безопасность</Text>
                                </View>
                            </View>
                            <View style={styles.rowInner}>
                                <Ionicons name="book-outline" size={26} color={colors.warning} />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Книга-подсказка при ЧС
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Пожар, газ, затопление, свет
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                            </View>
                        </Card>
                    </Pressable>
                    <Divider />
                    <Pressable
                        onPress={() => nav.navigate("EmergencyPhones")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={[styles.cardInner, styles.cardPhones]} padded>
                            <View style={styles.cardTop}>
                                <View style={[styles.badge, styles.badgePhones]}>
                                    <Text style={[styles.badgeText, { color: colors.primary }]}>Экстренные службы</Text>
                                </View>
                            </View>
                            <View style={styles.rowInner}>
                                <Ionicons name="call-outline" size={26} color={colors.primary} />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Аварийные телефоны
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Список нужных номеров
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                            </View>
                        </Card>
                    </Pressable>
                </View>
            ) : null}

            {tab === "rights" ? (
                <View style={styles.itemList}>
                    <Pressable
                        onPress={() => nav.navigate("RightsResidents")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={[styles.cardInner, styles.cardResidents]} padded>
                            <View style={styles.cardTop}>
                                <View style={[styles.badge, styles.badgeResidents]}>
                                    <Text style={[styles.badgeText, { color: colors.accent }]}>Права жильцов</Text>
                                </View>
                            </View>
                            <View style={styles.rowInner}>
                                <Ionicons name="people-outline" size={26} color={colors.accent} />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Жильцы
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Права и обязанности жильцов дома
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                            </View>
                        </Card>
                    </Pressable>
                    <Divider />
                    <Pressable
                        onPress={() => nav.navigate("RightsUk")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={[styles.cardInner, styles.cardUk]} padded>
                            <View style={styles.cardTop}>
                                <View style={[styles.badge, styles.badgeUk]}>
                                    <Text style={[styles.badgeText, { color: colors.info }]}>Обязанности УК</Text>
                                </View>
                            </View>
                            <View style={styles.rowInner}>
                                <Ionicons name="business-outline" size={26} color={colors.info} />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Управляющая компания
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Обязанности УК и информирование жильцов
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
                            </View>
                        </Card>
                    </Pressable>
                </View>
            ) : null}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    profileButton: { marginTop: spacing.xs },
    profileButtonPressed: { opacity: 0.6 },
    filterRow: {
        flexDirection: "row",
        gap: spacing.sm,
        paddingBottom: spacing.md,
        flexGrow: 0,
        alignItems: "center",
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignSelf: "flex-start",
    },
    filterChipOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    filterOnText: { color: colors.primary },
    filterOffText: { color: colors.textMuted },
    row: {},
    itemList: { gap: 0 },
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
    pressed: { opacity: 0.92 },
    cardInner: { overflow: "hidden" },
    cardGuide:     { borderLeftWidth: 3, borderLeftColor: colors.warning },
    cardPhones:    { borderLeftWidth: 3, borderLeftColor: colors.primary },
    cardResidents: { borderLeftWidth: 3, borderLeftColor: colors.accent },
    cardUk:        { borderLeftWidth: 3, borderLeftColor: colors.info },
    cardTop: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        marginBottom: spacing.sm,
    },
    badge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeGuide:     { backgroundColor: "rgba(232, 162, 61, 0.12)" },
    badgePhones:    { backgroundColor: "rgba(61, 158, 122, 0.15)" },
    badgeResidents: { backgroundColor: "rgba(212, 168, 83, 0.12)" },
    badgeUk:        { backgroundColor: "rgba(91, 159, 212, 0.15)" },
    badgeText: { fontSize: 11, fontWeight: "600" as const },
    rowInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    texts: { flex: 1 },
    rowTitle: { color: colors.text },
    rowSub: { color: colors.textMuted, marginTop: 4, lineHeight: 18 },
});
