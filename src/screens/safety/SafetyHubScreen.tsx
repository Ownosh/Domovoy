import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, ScreenLayout } from "../../components/ui";
import type { MainTabNavigationProp, SafetyStackParamList } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Nav = NativeStackNavigationProp<SafetyStackParamList>;

type SafetyTab = "quick" | "rights";

const SAFETY_TABS: { id: SafetyTab; label: string }[] = [
    { id: "quick", label: "Экстренно" },
    { id: "rights", label: "Права и обязанности" },
];

export function SafetyHubScreen() {
    const tabNav = useNavigation<MainTabNavigationProp>();
    const nav = useNavigation<Nav>();
    const [tab, setTab] = useState<SafetyTab>("quick");

    return (
        <ScreenLayout
            title="Памятка"
            rightAccessory={
                <Pressable
                    onPress={() => tabNav.navigate("Profile")}
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
                <>
                    <Pressable
                        onPress={() => nav.navigate("EmergencyGuide")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={styles.cardInner} padded>
                            <View style={styles.rowInner}>
                                <Ionicons
                                    name="book-outline"
                                    size={28}
                                    color={colors.warning}
                                />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Книга-подсказка при ЧС
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Пожар, газ, затопление, свет
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={22}
                                    color={colors.textDim}
                                />
                            </View>
                        </Card>
                    </Pressable>
                    <Pressable
                        onPress={() => nav.navigate("EmergencyPhones")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={styles.cardInner} padded>
                            <View style={styles.rowInner}>
                                <Ionicons
                                    name="call-outline"
                                    size={28}
                                    color={colors.primary}
                                />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Аварийные телефоны
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Список нужных номеров
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={22}
                                    color={colors.textDim}
                                />
                            </View>
                        </Card>
                    </Pressable>
                </>
            ) : null}

            {tab === "rights" ? (
                <>
                    <Pressable
                        onPress={() => nav.navigate("RightsResidents")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={styles.cardInner} padded>
                            <View style={styles.rowInner}>
                                <Ionicons
                                    name="people-outline"
                                    size={28}
                                    color={colors.accent}
                                />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Жильцы
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Права и обязанности жильцов дома
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={22}
                                    color={colors.textDim}
                                />
                            </View>
                        </Card>
                    </Pressable>
                    <Pressable
                        onPress={() => nav.navigate("RightsUk")}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                        <Card style={styles.cardInner} padded>
                            <View style={styles.rowInner}>
                                <Ionicons
                                    name="business-outline"
                                    size={28}
                                    color={colors.primary}
                                />
                                <View style={styles.texts}>
                                    <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                        Управляющая компания
                                    </Text>
                                    <Text style={[textStyles.caption, styles.rowSub]}>
                                        Обязанности УК и информирование жильцов
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={22}
                                    color={colors.textDim}
                                />
                            </View>
                        </Card>
                    </Pressable>
                </>
            ) : null}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
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
    row: { marginBottom: spacing.md },
    pressed: { opacity: 0.92 },
    cardInner: { overflow: "hidden" },
    rowInner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    texts: { flex: 1 },
    rowTitle: { color: colors.text },
    rowSub: { color: colors.textMuted, marginTop: 4, lineHeight: 18 },
});
