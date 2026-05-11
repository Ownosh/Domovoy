import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ScreenLayout } from "../../components/ui";
import type { MainTabNavigationProp, SafetyStackParamList } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Nav = NativeStackNavigationProp<SafetyStackParamList>;

export function SafetyHubScreen() {
    const tabNav = useNavigation<MainTabNavigationProp>();
    const nav = useNavigation<Nav>();

    return (
        <ScreenLayout
            title="Безопасность и ЧС"
            subtitle="Телефоны и памятка офлайн"
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
            <Pressable
                onPress={() => nav.navigate("EmergencyPhones")}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
                <Card style={styles.cardInner} padded>
                    <View style={styles.rowInner}>
                        <Ionicons name="call-outline" size={28} color={colors.primary} />
                        <View style={styles.texts}>
                            <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                Аварийные телефоны
                            </Text>
                            <Text style={[textStyles.caption, styles.rowSub]}>
                                Список нужных номеров
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
                    </View>
                </Card>
            </Pressable>
            <Pressable
                onPress={() => nav.navigate("EmergencyGuide")}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
                <Card style={styles.cardInner} padded>
                    <View style={styles.rowInner}>
                        <Ionicons name="book-outline" size={28} color={colors.warning} />
                        <View style={styles.texts}>
                            <Text style={[textStyles.subtitle, styles.rowTitle]}>
                                Книга-подсказка при ЧС
                            </Text>
                            <Text style={[textStyles.caption, styles.rowSub]}>
                                Пожар, газ, затопление, свет
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color={colors.textDim} />
                    </View>
                </Card>
            </Pressable>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    profileButton: { marginTop: spacing.xs },
    profileButtonPressed: { opacity: 0.6 },
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
