import type { ProfileScreenProps } from "../../navigation/types";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";
import type { UserApartment } from "../../types";
import { normalizeApartmentVerificationStatus } from "../../utils/apartmentVerification";

type Props = ProfileScreenProps<"Apartments">;

const statusConfig: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    none:     { label: "Не подана", color: colors.textDim, icon: "ellipse-outline" },
    pending:  { label: "На проверке", color: colors.warning, icon: "time-outline" },
    approved: { label: "Подтверждена", color: colors.primary, icon: "shield-checkmark-outline" },
    rejected: { label: "Отклонена", color: colors.danger, icon: "close-circle-outline" },
};

const docTypeLabel: Record<string, string> = {
    lease: "Договор аренды",
    ownership: "Право собственности",
};

export function ApartmentsScreen({ navigation }: Props) {
    const { apartments, activateApartment, removeApartment, fetchApartments } = useApp();
    const [loading, setLoading] = useState(false);

    const onRefresh = useCallback(() => { void fetchApartments(); }, [fetchApartments]);

    const handleActivate = useCallback(async (apt: UserApartment) => {
        if (apt.isActive) return;
        setLoading(true);
        const r = await activateApartment(apt.id);
        setLoading(false);
        if (!r.ok) {
            Alert.alert("Ошибка", (r as { ok: false; reason: string }).reason);
        }
    }, [activateApartment]);

    const handleRemove = useCallback((apt: UserApartment) => {
        Alert.alert(
            "Удалить квартиру?",
            `кв. ${apt.apartment}, ${apt.buildingName}\nЭто действие нельзя отменить.`,
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Удалить",
                    style: "destructive",
                    onPress: async () => {
                        const r = await removeApartment(apt.id);
                        if (!r.ok) Alert.alert("Ошибка", (r as { ok: false; reason: string }).reason);
                    },
                },
            ],
        );
    }, [removeApartment]);

    return (
        <ScreenLayout
            title="Мои квартиры"
            subtitle="Управление адресами"
            onBack={() => navigation.goBack()}
            onRefresh={onRefresh}
            refreshing={false}
        >
            {apartments.length === 0 ? (
                <Card style={styles.emptyCard}>
                    <View style={styles.emptyIconWrap}>
                        <Ionicons name="home-outline" size={40} color={colors.textDim} />
                    </View>
                    <Text style={[textStyles.subtitle, styles.emptyTitle]}>Нет квартир</Text>
                    <Text style={[textStyles.caption, styles.emptyHint]}>
                        Добавьте квартиру с подтверждающим документом
                    </Text>
                </Card>
            ) : (
                apartments.map((apt) => {
                    const displayStatus = normalizeApartmentVerificationStatus(apt.verificationStatus);
                    const cfg = statusConfig[displayStatus] ?? statusConfig.none;
                    return (
                        <Card key={apt.id} style={[styles.aptCard, apt.isActive && styles.aptCardActive]}>
                            {/* Шапка: адрес + активная метка */}
                            <View style={styles.aptHeader}>
                                <View style={styles.aptIconWrap}>
                                    <Ionicons
                                        name="home-outline"
                                        size={20}
                                        color={apt.isActive ? colors.primary : colors.textMuted}
                                    />
                                </View>
                                <View style={styles.aptHeaderText}>
                                    <Text style={[textStyles.subtitle, styles.aptAddress]} numberOfLines={1}>
                                        {apt.buildingName}
                                    </Text>
                                    <Text style={styles.aptAptLine}>
                                        Квартира {apt.apartment}
                                        {apt.entrance ? `, подъезд ${apt.entrance}` : ""}
                                    </Text>
                                </View>
                                {apt.isActive && (
                                    <View style={styles.activeBadge}>
                                        <Ionicons name="checkmark" size={11} color={colors.bg} />
                                        <Text style={styles.activeBadgeText}>Активная</Text>
                                    </View>
                                )}
                            </View>

                            {/* Статус верификации + тип документа */}
                            <View style={styles.statusRow}>
                                <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                                <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                                <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                {apt.docType ? (
                                    <Text style={styles.docTypeText}>· {docTypeLabel[apt.docType]}</Text>
                                ) : null}
                            </View>

                            {/* Комментарий при отклонении */}
                            {displayStatus === "rejected" && apt.reviewerComment && (
                                <View style={styles.commentBox}>
                                    <Ionicons name="chatbox-outline" size={13} color={colors.danger} />
                                    <Text style={styles.commentText} numberOfLines={3}>
                                        {apt.reviewerComment}
                                    </Text>
                                </View>
                            )}

                            {/* Кнопки */}
                            <View style={styles.actions}>
                                {!apt.isActive && (
                                    <Button
                                        title={loading ? "..." : "Сделать активной"}
                                        onPress={() => { void handleActivate(apt); }}
                                        disabled={loading}
                                        variant="primary"
                                        style={styles.actionBtn}
                                    />
                                )}
                                {apartments.length > 1 && (
                                    <Pressable
                                        onPress={() => handleRemove(apt)}
                                        style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
                                    >
                                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                                        <Text style={styles.removeBtnText}>Удалить</Text>
                                    </Pressable>
                                )}
                            </View>
                        </Card>
                    );
                })
            )}

            <Button
                title="Добавить квартиру"
                onPress={() => navigation.navigate("AddApartment")}
                variant="info"
                style={styles.addBtn}
            />
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    emptyCard: {
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.xl + 8,
    },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "rgba(154, 165, 181, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    emptyTitle: { color: colors.text },
    emptyHint: { color: colors.textDim, textAlign: "center" },

    aptCard: {
        gap: spacing.md,
    },
    aptCardActive: {
        borderWidth: 1,
        borderColor: `${colors.primary}55`,
    },
    aptHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    aptIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: "rgba(61, 158, 122, 0.12)",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    aptHeaderText: { flex: 1, gap: 2 },
    aptAddress: { color: colors.text, fontSize: 15 },
    aptAptLine: { fontSize: 13, color: colors.textMuted },
    activeBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: colors.primary,
    },
    activeBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: colors.bg,
        letterSpacing: 0.3,
    },

    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    statusLabel: {
        fontSize: 12,
        fontWeight: "600",
    },
    docTypeText: {
        fontSize: 12,
        color: colors.textDim,
    },

    commentBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: "rgba(224, 79, 95, 0.07)",
        borderWidth: 1,
        borderColor: `${colors.danger}30`,
    },
    commentText: {
        flex: 1,
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 17,
    },

    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        flexWrap: "wrap",
    },
    actionBtn: { flex: 1 },
    removeBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.danger}40`,
    },
    removeBtnPressed: { opacity: 0.7 },
    removeBtnText: { fontSize: 13, color: colors.danger },

    addBtn: { marginTop: spacing.sm },
});
