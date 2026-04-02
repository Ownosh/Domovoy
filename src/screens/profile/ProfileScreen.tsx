import type { ProfileScreenProps } from "../../navigation/types";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ScreenLayout } from "../../components/ui";
import { VerificationStatusBadge } from "../../components/ui/StatusBadge";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"ProfileMain">;

const rows: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    target:
        | "EditProfile"
        | "ChangePassword"
        | "Verification"
        | "AppealHistory"
        | "NotificationSettings"
        | "Contacts"
        | "DeleteAccount";
}[] = [
    { icon: "person-outline", title: "Личные данные", target: "EditProfile" },
    { icon: "key-outline", title: "Смена пароля", target: "ChangePassword" },
    { icon: "shield-checkmark-outline", title: "Верификация", target: "Verification" },
    { icon: "chatbubbles-outline", title: "История обращений", target: "AppealHistory" },
    { icon: "notifications-outline", title: "Уведомления", target: "NotificationSettings" },
    { icon: "business-outline", title: "Контакты УК", target: "Contacts" },
    { icon: "trash-outline", title: "Удалить аккаунт", target: "DeleteAccount" },
];

export function ProfileScreen({ navigation }: Props) {
    const { profile, user, logout, verification } = useApp();

    return (
        <ScreenLayout title="Профиль" subtitle={user?.email ?? ""}>
            <Card style={styles.hero}>
                <View style={styles.avatar}>
                    <Ionicons name="home" size={32} color={colors.primary} />
                </View>
                <Text style={[textStyles.title, styles.name]}>
                    {profile.name || "Житель"}
                </Text>
                <Text style={[textStyles.caption, styles.sub]}>
                    {profile.apartment ? `Кв. ${profile.apartment}` : ""}
                    {profile.phone ? ` · ${profile.phone}` : ""}
                </Text>
                <View style={styles.verifyRow}>
                    <Text style={[textStyles.caption, styles.verifyLabel]}>
                        Верификация:
                    </Text>
                    <VerificationStatusBadge status={verification.status} />
                    {verification.status === "none" && (
                        <Text style={[textStyles.caption, styles.none]}>
                            не пройдена
                        </Text>
                    )}
                </View>
            </Card>

            <Card padded={false}>
                {rows.map((r, i) => (
                    <Pressable
                        key={r.target}
                        onPress={() => navigation.navigate(r.target)}
                        style={[
                            styles.row,
                            i < rows.length - 1 && styles.rowBorder,
                        ]}
                    >
                        <Ionicons
                            name={r.icon}
                            size={22}
                            color={
                                r.target === "DeleteAccount"
                                    ? colors.danger
                                    : colors.textMuted
                            }
                        />
                        <Text
                            style={[
                                textStyles.body,
                                styles.rowTitle,
                                r.target === "DeleteAccount" && styles.dangerText,
                            ]}
                        >
                            {r.title}
                        </Text>
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={colors.textDim}
                        />
                    </Pressable>
                ))}
            </Card>

            <Pressable onPress={logout} style={styles.logout}>
                <Text style={[textStyles.subtitle, styles.logoutText]}>
                    Выйти из аккаунта
                </Text>
            </Pressable>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    hero: { alignItems: "center" },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.md,
    },
    name: { color: colors.text },
    sub: { color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" },
    verifyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.lg,
        flexWrap: "wrap",
        justifyContent: "center",
    },
    verifyLabel: { color: colors.textDim },
    none: { color: colors.textDim },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
    rowTitle: { flex: 1, color: colors.text },
    dangerText: { color: colors.danger },
    logout: {
        alignItems: "center",
        paddingVertical: spacing.lg,
        marginBottom: spacing.xl,
    },
    logoutText: { color: colors.textMuted },
});
