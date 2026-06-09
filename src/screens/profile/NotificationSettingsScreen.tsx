import type { ProfileScreenProps } from "../../navigation/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ScreenLayout, ToggleRow } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"NotificationSettings">;

type NotifItem = {
    key: "outages" | "meetings" | "announcements" | "general";
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
};

const items: NotifItem[] = [
    {
        key: "outages",
        title: "Отключения коммуникаций",
        description: "Вода, свет, отопление — плановые и аварийные",
        icon: "flash-outline",
        iconColor: colors.warning,
    },
    {
        key: "meetings",
        title: "Собрания жильцов",
        description: "Очные и онлайн собрания собственников",
        icon: "people-outline",
        iconColor: colors.info,
    },
    {
        key: "announcements",
        title: "Объявления УК",
        description: "Официальные сообщения управляющей компании",
        icon: "megaphone-outline",
        iconColor: colors.accent,
    },
    {
        key: "general",
        title: "Прочие",
        description: "Общие напоминания и сервисные сообщения",
        icon: "apps-outline",
        iconColor: colors.textMuted,
    },
];

export function NotificationSettingsScreen({ navigation }: Props) {
    const { notificationPrefs, toggleNotificationPref } = useApp();

    const enabledCount = items.filter((i) => notificationPrefs[i.key]).length;

    return (
        <ScreenLayout
            title="Уведомления"
            subtitle="Управление оповещениями"
            onBack={() => navigation.goBack()}
        >
            {/* ── Инфо-баннер ── */}
            <Card style={styles.banner}>
                <View style={styles.bannerIcon}>
                    <Ionicons name="notifications" size={22} color={colors.primary} />
                </View>
                <View style={styles.bannerText}>
                    <Text style={[textStyles.subtitle, styles.bannerTitle]}>
                        Push-уведомления
                    </Text>
                    <Text style={[textStyles.caption, styles.bannerBody]}>
                        Включите нужные категории — и мы пришлём оповещение как только появится важное событие.
                    </Text>
                </View>
            </Card>

            {/* ── Счётчик активных ── */}
            <View style={styles.counterRow}>
                <Text style={styles.counterLabel}>Активных категорий</Text>
                <View style={[styles.counterBadge, enabledCount === 0 && styles.counterBadgeOff]}>
                    <Text style={[styles.counterText, enabledCount === 0 && styles.counterTextOff]}>
                        {enabledCount} из {items.length}
                    </Text>
                </View>
            </View>

            {/* ── Переключатели ── */}
            <Card padded={false}>
                {items.map((item, i) => (
                    <View key={item.key}>
                        <ToggleRow
                            title={item.title}
                            description={item.description}
                            value={notificationPrefs[item.key]}
                            onValueChange={() => toggleNotificationPref(item.key)}
                            icon={item.icon}
                            iconColor={item.iconColor}
                        />
                        {i < items.length - 1 && <View style={styles.divider} />}
                    </View>
                ))}
            </Card>

            {/* ── Подсказка ── */}
            <View style={styles.hint}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textDim} />
                <Text style={styles.hintText}>
                    Для получения уведомлений убедитесь, что они разрешены в настройках устройства.
                </Text>
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    /* Баннер */
    banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    bannerIcon: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    bannerText: { flex: 1, gap: 3 },
    bannerTitle: { color: colors.text },
    bannerBody: { color: colors.textMuted, lineHeight: 18 },

    /* Счётчик */
    counterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.xs,
    },
    counterLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.textDim,
        letterSpacing: 0.3,
        textTransform: "uppercase",
    },
    counterBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        borderRadius: radius.full,
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: `${colors.primary}44`,
    },
    counterBadgeOff: {
        backgroundColor: "rgba(107, 119, 136, 0.12)",
        borderColor: colors.borderSubtle,
    },
    counterText: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.primary,
    },
    counterTextOff: { color: colors.textDim },

    /* Разделитель */
    divider: {
        height: 1,
        backgroundColor: colors.borderSubtle,
        marginLeft: spacing.lg + 36 + spacing.md,
    },

    /* Подсказка */
    hint: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    hintText: {
        flex: 1,
        fontSize: 12,
        color: colors.textDim,
        lineHeight: 17,
    },
});
