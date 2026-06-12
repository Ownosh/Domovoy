import type { ProfileScreenProps } from "../../navigation/types";
import React, { useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ScreenLayout } from "../../components/ui";
import { VerificationStatusBadge } from "../../components/ui/StatusBadge";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"ProfileMain">;

type RowDef = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    iconColor: string;
    iconBg: string;
    target:
        | "EditProfile"
        | "ChangePassword"
        | "Verification"
        | "AppealHistory"
        | "NotificationSettings"
        | "Contacts"
        | "HouseChat"
        | "DeleteAccount"
        | "Apartments";
    danger?: boolean;
};

type Section = {
    label?: string;
    rows: RowDef[];
};

export function ProfileScreen({ navigation }: Props) {
    const { profile, user, logout, verification, refreshFeed, apartments } = useApp();

    const sections: Section[] = [
        {
            label: "Аккаунт",
            rows: [
                {
                    icon: "person-outline",
                    title: "Личные данные",
                    subtitle: "Имя, телефон, адрес квартиры",
                    iconColor: colors.info,
                    iconBg: "rgba(91, 159, 212, 0.15)",
                    target: "EditProfile",
                },
                {
                    icon: "key-outline",
                    title: "Смена пароля",
                    subtitle: "Обновить пароль для входа",
                    iconColor: colors.accent,
                    iconBg: colors.accentSoft,
                    target: "ChangePassword",
                },
                {
                    icon: "shield-checkmark-outline",
                    title: "Верификация",
                    subtitle: "Подтверждение права на жильё",
                    iconColor: colors.primary,
                    iconBg: colors.primarySoft,
                    target: "Verification",
                },
                {
                    icon: "copy-outline",
                    title: "Мои квартиры",
                    subtitle: apartments.length > 0
                        ? `${apartments.length} ${apartments.length === 1 ? "квартира" : apartments.length < 5 ? "квартиры" : "квартир"}`
                        : "Добавить адрес или переключить активный",
                    iconColor: colors.info,
                    iconBg: "rgba(91, 159, 212, 0.15)",
                    target: "Apartments",
                },
            ],
        },
        {
            label: "Активность",
            rows: [
                {
                    icon: "archive-outline",
                    title: "Архив",
                    subtitle: "Завершённые обращения",
                    iconColor: colors.textMuted,
                    iconBg: "rgba(154, 165, 181, 0.12)",
                    target: "AppealHistory",
                },
                {
                    icon: "notifications-outline",
                    title: "Уведомления",
                    subtitle: "Типы и способы оповещений",
                    iconColor: colors.warning,
                    iconBg: "rgba(232, 162, 61, 0.12)",
                    target: "NotificationSettings",
                },
                {
                    icon: "business-outline",
                    title: "Контакты УК",
                    subtitle: "Телефон и часы работы",
                    iconColor: colors.info,
                    iconBg: "rgba(91, 159, 212, 0.12)",
                    target: "Contacts",
                },
                {
                    icon: "chatbubbles-outline",
                    title: "Домовой чат",
                    subtitle: "Официальный чат жителей дома",
                    iconColor: colors.primary,
                    iconBg: colors.primarySoft,
                    target: "HouseChat",
                },
            ],
        },
        {
            rows: [
                {
                    icon: "trash-outline",
                    title: "Удалить аккаунт",
                    subtitle: "Удаление профиля и данных",
                    iconColor: colors.danger,
                    iconBg: colors.dangerSoft,
                    target: "DeleteAccount",
                    danger: true,
                },
            ],
        },
    ];

    const onRefresh = useCallback(() => { void refreshFeed(); }, [refreshFeed]);

    const displayBuilding = profile.buildingName || profile.building;
    const initials = (profile.name || "Ж")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");

    return (
        <ScreenLayout
            title="Профиль"
            subtitle={user?.email ?? ""}
            onRefresh={onRefresh}
            refreshing={false}
        >
            {/* ── Hero ── */}
            <Card style={styles.hero}>
                <View style={styles.avatarWrap}>
                    {profile.profilePhoto ? (
                        <Image source={{ uri: profile.profilePhoto }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarInner}>
                            <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                    )}
                    {verification.status === "approved" && (
                        <View style={styles.verifyDot}>
                            <Ionicons name="checkmark" size={10} color={colors.bg} />
                        </View>
                    )}
                </View>

                <Text style={[textStyles.title, styles.heroName]}>
                    {profile.name || "Житель"}
                </Text>

                <View style={styles.chipRow}>
                    {!!displayBuilding && (
                        <View style={styles.chip}>
                            <Ionicons name="home-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.chipText} numberOfLines={1}>
                                {displayBuilding}
                            </Text>
                        </View>
                    )}
                    {!!profile.apartment && (
                        <View style={styles.chip}>
                            <Ionicons name="grid-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.chipText}>кв. {profile.apartment}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.verifyRow}>
                    <VerificationStatusBadge status={verification.status} />
                    {verification.status === "none" && (
                        <Text style={[textStyles.caption, styles.verifyHint]}>
                            верификация не пройдена
                        </Text>
                    )}
                </View>
            </Card>

            {/* ── Sections ── */}
            {sections.map((section, si) => (
                <View key={si}>
                    {section.label && (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionLabel}>{section.label}</Text>
                            <View style={styles.sectionLine} />
                        </View>
                    )}
                    <Card padded={false}>
                        {section.rows.map((row, ri) => (
                            <Pressable
                                key={row.target}
                                onPress={() => navigation.navigate(row.target)}
                                style={({ pressed }) => [
                                    styles.row,
                                    ri < section.rows.length - 1 && styles.rowBorder,
                                    pressed && styles.rowPressed,
                                ]}
                            >
                                <View style={[styles.iconWrap, { backgroundColor: row.iconBg }]}>
                                    <Ionicons name={row.icon} size={20} color={row.iconColor} />
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={[
                                        textStyles.subtitle,
                                        styles.rowTitle,
                                        row.danger && styles.dangerText,
                                    ]}>
                                        {row.title}
                                    </Text>
                                    <Text style={styles.rowSub}>{row.subtitle}</Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={row.danger ? colors.danger : colors.textDim}
                                    style={styles.chevron}
                                />
                            </Pressable>
                        ))}
                    </Card>
                </View>
            ))}

            {/* ── Logout ── */}
            <Pressable
                onPress={logout}
                style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutPressed]}
            >
                <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
                <Text style={[textStyles.subtitle, styles.logoutText]}>
                    Выйти из аккаунта
                </Text>
            </Pressable>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    /* Hero */
    hero: {
        alignItems: "center",
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        gap: spacing.sm,
    },
    avatarWrap: {
        position: "relative",
        marginBottom: spacing.sm,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    avatarInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primarySoft,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitials: {
        fontSize: 28,
        fontWeight: "700",
        color: colors.primary,
        letterSpacing: -0.5,
    },
    verifyDot: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.primary,
        borderWidth: 2,
        borderColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    heroName: {
        color: colors.text,
        textAlign: "center",
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        justifyContent: "center",
        marginTop: spacing.xs,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        borderRadius: radius.full,
        backgroundColor: "rgba(42, 53, 68, 0.8)",
        borderWidth: 1,
        borderColor: colors.border,
        maxWidth: 200,
    },
    chipText: {
        fontSize: 12,
        color: colors.textMuted,
        flexShrink: 1,
    },
    verifyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    verifyHint: {
        color: colors.textDim,
    },

    /* Section */
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.sm,
        marginTop: spacing.xs,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: colors.textDim,
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.borderSubtle,
    },

    /* Row */
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    rowPressed: {
        backgroundColor: colors.surfaceHover,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    rowTitle: {
        color: colors.text,
        fontSize: 15,
    },
    rowSub: {
        fontSize: 12,
        color: colors.textDim,
    },
    dangerText: {
        color: colors.danger,
    },
    chevron: {
        opacity: 0.6,
    },

    /* Logout */
    logoutBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        marginBottom: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: "rgba(26, 35, 46, 0.5)",
    },
    logoutPressed: {
        opacity: 0.7,
    },
    logoutText: {
        color: colors.textMuted,
        fontSize: 15,
    },
});
