import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { MainTabNavigationProp } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";

const typeMeta: Record<string, { label: string; color: string }> = {
    outage: { label: "Отключения", color: colors.warning },
    meeting: { label: "Собрания", color: colors.accent },
    announcement: { label: "Объявления", color: colors.info },
    general: { label: "Общее", color: colors.textMuted },
};

export function HomeScreen() {
    const navigation = useNavigation<MainTabNavigationProp>();
    const {
        news,
        visibleNotifications,
        markNotificationRead,
        profile,
    } = useApp();

    return (
        <ScreenLayout
            title="Домовой"
            subtitle={`Здравствуйте, ${profile.name || "сосед"}`}
        >
            <Text style={[textStyles.label, styles.section]}>Уведомления</Text>
            <View style={styles.notifList}>
                {visibleNotifications.slice(0, 5).map((n) => {
                    const m = typeMeta[n.type] ?? typeMeta.general;
                    return (
                        <Pressable
                            key={n.id}
                            onPress={() => markNotificationRead(n.id)}
                        >
                            <Card
                                style={[
                                    styles.notifCard,
                                    !n.read && styles.notifUnread,
                                ]}
                                padded
                            >
                                <View style={styles.notifTop}>
                                    <View
                                        style={[
                                            styles.tag,
                                            { backgroundColor: `${m.color}28` },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                textStyles.caption,
                                                { color: m.color },
                                            ]}
                                        >
                                            {m.label}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            textStyles.caption,
                                            styles.date,
                                        ]}
                                    >
                                        {formatDate(n.date)}
                                    </Text>
                                </View>
                                <Text
                                    style={[textStyles.subtitle, styles.ntitle]}
                                >
                                    {n.title}
                                </Text>
                                <Text style={[textStyles.caption, styles.nbody]}>
                                    {n.body}
                                </Text>
                            </Card>
                        </Pressable>
                    );
                })}
            </View>
            <Text style={[textStyles.label, styles.section]}>Новости УК</Text>
            {news.map((item) => (
                <Card key={item.id} style={styles.newsCard} padded>
                    <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.newsImg}
                    />
                    <Text style={[textStyles.caption, styles.newsDate]}>
                        {item.date}
                    </Text>
                    <Text style={[textStyles.subtitle, styles.newsTitle]}>
                        {item.title}
                    </Text>
                    <Text style={[textStyles.body, styles.newsExcerpt]}>
                        {item.excerpt}
                    </Text>
                </Card>
            ))}
        </ScreenLayout>
    );
}

function formatDate(iso: string) {
    try {
        const d = new Date(iso);
        return d.toLocaleString("ru-RU", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    section: { color: colors.textMuted, marginTop: spacing.sm },
    notifList: { gap: spacing.md },
    notifCard: { gap: spacing.sm },
    notifUnread: {
        borderColor: colors.primary,
        borderWidth: 1,
    },
    notifTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
    date: { color: colors.textDim },
    ntitle: { color: colors.text },
    nbody: { color: colors.textMuted },
    manageLink: { color: colors.primary },
    newsCard: { overflow: "hidden" },
    newsImg: {
        width: "100%",
        height: 140,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.border,
    },
    newsDate: { color: colors.textDim },
    newsTitle: { color: colors.text, marginTop: spacing.xs },
    newsExcerpt: { color: colors.textMuted, marginTop: spacing.sm },
});
