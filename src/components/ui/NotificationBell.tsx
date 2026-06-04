import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState, useMemo } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import type { AppNotification } from "../../types";
import { colors, spacing, textStyles } from "../../theme";
import { Card } from "./Card";

const typeMeta: Record<string, { label: string; color: string }> = {
    outage: { label: "Отключения", color: colors.warning },
    meeting: { label: "Собрания", color: colors.accent },
    announcement: { label: "Объявления", color: colors.info },
    general: { label: "Общее", color: colors.textMuted },
};

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString("ru-RU", {
            day: "numeric", month: "short", year: "numeric",
        });
    } catch { return iso; }
}

function NotifRow({
    n,
    onOpen,
}: {
    n: AppNotification;
    onOpen: () => void;
}) {
    const lastTap = useRef<number>(0);
    const m = typeMeta[n.type] ?? typeMeta.general;

    const handlePress = () => {
        const now = Date.now();
        if (now - lastTap.current < 350) {
            onOpen();
        }
        lastTap.current = now;
    };

    return (
        <Pressable onPress={handlePress}>
            <Card style={[styles.notifCard, !n.read && styles.notifUnread]} padded>
                <View style={styles.notifTop}>
                    <View style={[styles.tag, { backgroundColor: `${m.color}28` }]}>
                        <Text style={[textStyles.caption, { color: m.color }]}>{m.label}</Text>
                    </View>
                    <Text style={[textStyles.caption, styles.date]}>{formatDate(n.date)}</Text>
                </View>
                <Text style={[textStyles.subtitle, styles.ntitle]}>{n.title}</Text>
                <Text style={[textStyles.caption, styles.nbody]}>{n.body}</Text>
                <View style={styles.checkRow}>
                    <Ionicons
                        name={n.read ? "checkmark-done" : "checkmark"}
                        size={16}
                        color={n.read ? colors.primary : colors.textDim}
                    />
                </View>
            </Card>
        </Pressable>
    );
}

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [detail, setDetail] = useState<AppNotification | null>(null);
    const { visibleNotifications, markNotificationRead, markAllNotificationsRead, verification } = useApp();

    if (!isVerifiedResident(verification)) return null;

    const unreadCount = useMemo(
        () => visibleNotifications.filter((n) => !n.read).length,
        [visibleNotifications],
    );

    const handleOpen = (n: AppNotification) => {
        markNotificationRead(n.id);
        setDetail(n);
    };

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                hitSlop={10}
                style={({ pressed }) => [styles.bellBtn, pressed && styles.bellPressed]}
            >
                <Ionicons name="notifications-outline" size={26} color={colors.text} />
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 9 ? "9+" : String(unreadCount)}
                        </Text>
                    </View>
                )}
            </Pressable>

            {/* Список уведомлений */}
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.header}>
                            <Text style={[textStyles.subtitle, styles.title]}>Уведомления</Text>
                            <View style={styles.headerRight}>
                                {visibleNotifications.some((n) => !n.read) && (
                                    <Pressable onPress={markAllNotificationsRead} hitSlop={10} style={styles.readAllBtn}>
                                        <Ionicons name="checkmark-done" size={22} color={colors.primary} />
                                    </Pressable>
                                )}
                                <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                                    <Ionicons name="close" size={26} color={colors.text} />
                                </Pressable>
                            </View>
                        </View>
                        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                            {visibleNotifications.length === 0 ? (
                                <Text style={[textStyles.body, styles.empty]}>Пока нет уведомлений.</Text>
                            ) : (
                                visibleNotifications.map((n) => (
                                    <NotifRow
                                        key={n.id}
                                        n={n}
                                        onOpen={() => handleOpen(n)}
                                    />
                                ))
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Детальный вид */}
            <Modal visible={detail !== null} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
                <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
                    <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
                        {detail && (() => {
                            const m = typeMeta[detail.type] ?? typeMeta.general;
                            return (
                                <>
                                    <View style={styles.header}>
                                        <View style={[styles.tag, { backgroundColor: `${m.color}28` }]}>
                                            <Text style={[textStyles.caption, { color: m.color }]}>{m.label}</Text>
                                        </View>
                                        <Pressable onPress={() => setDetail(null)} hitSlop={12}>
                                            <Ionicons name="close" size={26} color={colors.text} />
                                        </Pressable>
                                    </View>
                                    <Text style={[textStyles.caption, styles.date]}>{formatDate(detail.date)}</Text>
                                    <Text style={[textStyles.subtitle, styles.ntitle]}>{detail.title}</Text>
                                    <Text style={[textStyles.body, { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 }]}>
                                        {detail.body}
                                    </Text>
                                </>
                            );
                        })()}
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    bellBtn: { position: "relative", padding: 2 },
    bellPressed: { opacity: 0.65 },
    badge: {
        position: "absolute", right: -4, top: -2,
        minWidth: 18, height: 18, borderRadius: 9,
        backgroundColor: colors.danger,
        alignItems: "center", justifyContent: "center",
        paddingHorizontal: 4,
    },
    badgeText: { color: colors.bg, fontSize: 10, fontWeight: "700" },
    backdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: "flex-end",
    },
    sheet: {
        maxHeight: "78%",
        backgroundColor: colors.bgElevated,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomWidth: 0,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    readAllBtn: { padding: spacing.xs },
    title: { color: colors.text },
    scroll: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
    },
    empty: { color: colors.textMuted, paddingVertical: spacing.xl },
    notifCard: { gap: spacing.sm, marginBottom: spacing.md },
    notifUnread: { borderColor: colors.primary, borderWidth: 1 },
    notifTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    tag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 16,
    },
    date: { color: colors.textDim },
    ntitle: { color: colors.text },
    nbody: { color: colors.textMuted },
    checkRow: { alignItems: "flex-end", marginTop: spacing.xs },
    detailCard: {
        margin: spacing.lg,
        backgroundColor: colors.bgElevated,
        borderRadius: 16,
        padding: spacing.lg,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
});
