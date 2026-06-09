import { Ionicons } from "@expo/vector-icons";
import type { CommunityScreenProps } from "../../navigation/types";
import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { AdStatusBadge, Button, Card, ScreenLayout, StatusTimeline } from "../../components/ui";
import { adLabels, adStatusColor } from "../../components/ui/StatusBadge";
import type { TimelineStep } from "../../components/ui/StatusTimeline";
import { adEffectiveStatus } from "../../utils/appeals";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";
import type { NeighborAdStatus } from "../../types";

type Props = CommunityScreenProps<"NeighborAdDetail">;

function useModalBack() {
    const nav = useNavigation();
    const parentRouteNames = nav.getParent()?.getState()?.routeNames;
    const isModal = parentRouteNames?.includes("Main");
    return () => isModal ? nav.getParent()?.goBack() : nav.goBack();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const AD_CHAIN: NeighborAdStatus[] = ["new", "under_review", "published", "archived"];

const adIcons: Partial<Record<NeighborAdStatus, keyof typeof Ionicons.glyphMap>> = {
    new: "radio-button-on-outline",
    under_review: "time-outline",
    under_review_appeal: "time-outline",
    published: "play-forward-outline",
    archived: "archive-outline",
    rejected: "close-circle-outline",
};

function getAdSteps(status: NeighborAdStatus): TimelineStep[] {
    const base = AD_CHAIN.includes(status) ? AD_CHAIN : [...AD_CHAIN, status];
    return base.map((s) => ({
        key: s,
        label: adLabels[s] ?? s,
        color: adStatusColor[s] ?? colors.textMuted,
        icon: adIcons[s],
    }));
}

const adCatRu: Record<string, string> = {
    sell: "Продаю", buy: "Ищу", lost: "Потеряно",
    found: "Найдено", service: "Услуга", invite: "Приглашаю", other: "Другое",
};

const adCatIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    sell: "pricetag-outline", buy: "search-outline", lost: "help-circle-outline",
    found: "checkmark-circle-outline", service: "construct-outline",
    invite: "people-outline", other: "ellipsis-horizontal-outline",
};

function formatAdDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }); } catch { return iso; }
}

function formatTimeLeft(ms: number): string {
    if (ms <= 0) return "Истёк";
    const totalMin = Math.floor(ms / 60_000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days} дн. ${hours} ч.`;
    if (hours > 0) return `${hours} ч. ${mins} мин.`;
    return `${mins} мин.`;
}

function getCleanPhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    return digits.startsWith("7") ? `+${digits}` : `+7${digits}`;
}

export function NeighborAdDetailScreen({ route, navigation }: Props) {
    const goBack = useModalBack();
    const { neighborAds, user, reportNeighborAd, extendNeighborAd, deleteNeighborAd } = useApp();
    const ad = neighborAds.find((a) => a.id === route.params.id);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setTick((x) => x + 1), 60_000);
        return () => clearInterval(t);
    }, []);
    void tick;

    if (!ad) {
        return (
            <ScreenLayout title="Объявление" onBack={goBack}>
                <Text style={[textStyles.body, styles.miss]}>Объявление не найдено</Text>
            </ScreenLayout>
        );
    }

    const isAuthor = String(user?.id) === String(ad.authorUserId);
    const msLeft = new Date(ad.expiresAt).getTime() - Date.now();
    const expired = msLeft <= 0;
    const canExtend = isAuthor && msLeft <= WEEK_MS;
    const adStatus = adEffectiveStatus(ad);
    const sc = adStatusColor[adStatus] ?? colors.textMuted;
    const phone = ad.showPhone ? getCleanPhone(ad.authorPhone ?? "") : null;

    const onCall = () => {
        if (!phone) {
            Alert.alert("Номер недоступен", "Автор не указал телефон для связи.");
            return;
        }
        Linking.openURL(`tel:${phone}`).catch(() => {});
    };

    const onMessage = () => {
        if (!phone) {
            Alert.alert("Номер недоступен", "Автор не указал телефон для связи.");
            return;
        }
        Linking.openURL(`sms:${phone}`).catch(() => {});
    };

    const onReport = () => {
        if (isAuthor) return;
        Alert.alert(
            "Пожаловаться",
            "Отправить объявление на проверку управляющей компании?",
            [
                { text: "Отмена", style: "cancel" },
                { text: "Отправить жалобу", style: "destructive", onPress: () => reportNeighborAd(ad.id) },
            ],
        );
    };

    const timerColor = expired ? colors.danger : msLeft <= WEEK_MS ? colors.warning : colors.textDim;

    return (
        <ScreenLayout title="Объявление" scroll onBack={goBack}>

            {/* ── Лента статусов ── */}
            <View style={styles.timelineWrap}>
                <StatusTimeline steps={getAdSteps(adStatus)} currentKey={adStatus} />
            </View>

            {/* ── Основная карточка ── */}
            <Card style={[styles.mainCard, { borderLeftColor: sc }]}>
                {/* Верхняя строка: бейджи + дата */}
                <View style={styles.topRow}>
                    <AdStatusBadge status={adStatus} />
                    <View style={[styles.catBadge, { borderColor: `${sc}44`, backgroundColor: `${sc}0d` }]}>
                        <Ionicons name={adCatIcon[ad.category] ?? "ellipsis-horizontal-outline"} size={11} color={sc} />
                        <Text style={[styles.catBadgeText, { color: sc }]}>
                            {adCatRu[ad.category] ?? "Объявление"}
                        </Text>
                    </View>
                    <Text style={styles.cardDate}>{formatAdDate(ad.createdAt)}</Text>
                </View>

                {/* Заголовок */}
                <Text style={[textStyles.title, styles.title]}>{ad.title}</Text>

                {/* Автор */}
                {ad.authorName ? (
                    <View style={styles.authorRow}>
                        <View style={[styles.authorAvatar, { backgroundColor: `${sc}18`, borderColor: `${sc}33` }]}>
                            <Ionicons name="person-outline" size={14} color={sc} />
                        </View>
                        <Text style={[textStyles.caption, styles.authorName]}>{ad.authorName}</Text>
                    </View>
                ) : null}

                {/* Фото */}
                {ad.imageUrls.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgScroll}>
                        {ad.imageUrls.map((uri, i) => (
                            <Image key={i} source={{ uri }} style={styles.img} />
                        ))}
                    </ScrollView>
                )}

                {/* Разделитель + текст */}
                <View style={styles.divider} />
                <Text style={[textStyles.body, styles.body]}>{ad.body}</Text>

                {/* Таймер */}
                <View style={[styles.timerPill, { backgroundColor: `${timerColor}14`, borderColor: `${timerColor}44` }]}>
                    <Ionicons name={expired ? "close-circle-outline" : "time-outline"} size={14} color={timerColor} />
                    <Text style={[styles.timerText, { color: timerColor }]}>
                        {expired ? "Объявление истекло" : `Активно ещё: ${formatTimeLeft(msLeft)}`}
                    </Text>
                </View>
            </Card>

            {/* ── Действия (не автор) ── */}
            {!isAuthor && adStatus !== "under_review" && adStatus !== "under_review_appeal" && (
                <View style={styles.actionsSection}>
                    <View style={styles.actionRow}>
                        <Pressable
                            onPress={onCall}
                            style={({ pressed }) => [styles.actionBtn, styles.actionBtnCall, pressed && styles.actionBtnPressed]}
                        >
                            <Ionicons name="call-outline" size={18} color={colors.bg} />
                            <Text style={styles.actionBtnText}>Позвонить</Text>
                        </Pressable>

                        <Pressable
                            onPress={onMessage}
                            style={({ pressed }) => [styles.actionBtn, styles.actionBtnMsg, { borderColor: `${sc}55`, backgroundColor: `${sc}10` }, pressed && styles.actionBtnPressed]}
                        >
                            <Ionicons name="chatbubble-outline" size={18} color={sc} />
                            <Text style={[styles.actionBtnText, { color: sc }]}>Написать</Text>
                        </Pressable>

                        <Pressable
                            hitSlop={8}
                            onPress={onReport}
                            style={({ pressed }) => [styles.reportBtn, pressed && styles.actionBtnPressed]}
                        >
                            <Ionicons name="flag-outline" size={20} color={colors.danger} />
                        </Pressable>
                    </View>
                    {!phone && (
                        <Text style={styles.noPhoneHint}>Автор скрыл номер — звонок и сообщения недоступны</Text>
                    )}
                </View>
            )}

            {/* ── Действия автора ── */}
            {isAuthor && (
                <View style={styles.actionsSection}>
                    {canExtend && (
                        <Button
                            title="Продлить на 30 дней"
                            onPress={() => extendNeighborAd(ad.id)}
                            variant="secondary"
                            style={styles.extendBtn}
                        />
                    )}
                    {!canExtend && !expired && (
                        <Text style={styles.extendHint}>Продление доступно за 7 дней до истечения</Text>
                    )}
                    <View style={styles.ownerIconRow}>
                        <Pressable
                            hitSlop={10}
                            onPress={() => navigation.navigate("NeighborAdNew", { editId: ad.id })}
                            style={({ pressed }) => [styles.iconBtn, styles.iconBtnEdit, pressed && styles.iconBtnPressed]}
                        >
                            <Ionicons name="create-outline" size={20} color={colors.bg} />
                        </Pressable>
                        <Pressable
                            hitSlop={10}
                            onPress={() =>
                                Alert.alert("Удалить объявление?", "Это действие нельзя отменить.", [
                                    { text: "Отмена", style: "cancel" },
                                    {
                                        text: "Удалить",
                                        style: "destructive",
                                        onPress: () => { deleteNeighborAd(ad.id); navigation.goBack(); },
                                    },
                                ])
                            }
                            style={({ pressed }) => [styles.iconBtn, styles.iconBtnDelete, pressed && styles.iconBtnPressed]}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.bg} />
                        </Pressable>
                    </View>
                </View>
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    miss: { color: colors.textMuted },

    timelineWrap: {
        marginHorizontal: -spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        marginBottom: spacing.md,
    },

    // Main card
    mainCard: { borderLeftWidth: 3, gap: spacing.sm },
    topRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
    catBadge: {
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: spacing.sm, paddingVertical: 3,
        borderRadius: radius.full, borderWidth: 1,
    },
    catBadgeText: { fontSize: 11, fontWeight: "600" },
    cardDate: { fontSize: 12, color: colors.textDim, marginLeft: "auto" as any },
    title: { color: colors.text, marginTop: spacing.xs },

    authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    authorAvatar: {
        width: 26, height: 26, borderRadius: 13,
        alignItems: "center", justifyContent: "center", borderWidth: 1,
    },
    authorName: { color: colors.textMuted },

    imgScroll: { marginTop: spacing.sm },
    img: { width: 240, height: 160, borderRadius: radius.md, backgroundColor: colors.border, marginRight: spacing.sm },

    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.sm },
    body: { color: colors.textMuted, lineHeight: 22 },

    timerPill: {
        flexDirection: "row", alignItems: "center", gap: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: 6,
        borderRadius: radius.full, borderWidth: 1,
        alignSelf: "flex-start", marginTop: spacing.xs,
    },
    timerText: { fontSize: 12, fontWeight: "600" },

    // Actions (non-author)
    actionsSection: { marginTop: spacing.lg, gap: spacing.sm },
    actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    actionBtn: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: spacing.xs, paddingVertical: 13, borderRadius: radius.md,
    },
    actionBtnCall: { backgroundColor: colors.primary },
    actionBtnMsg: { borderWidth: 1.5 },
    actionBtnText: { fontSize: 14, fontWeight: "700", color: colors.bg },
    actionBtnPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    reportBtn: {
        width: 46, height: 46, borderRadius: radius.md,
        alignItems: "center", justifyContent: "center",
        backgroundColor: `${colors.danger}14`,
        borderWidth: 1, borderColor: `${colors.danger}33`,
    },
    noPhoneHint: { fontSize: 12, color: colors.textDim, textAlign: "center" },

    // Actions (author)
    extendBtn: { marginBottom: spacing.xs },
    extendHint: { fontSize: 12, color: colors.textDim, marginBottom: spacing.xs },
    ownerIconRow: { flexDirection: "row", gap: spacing.md, alignSelf: "flex-end" },
    iconBtn: {
        width: 46, height: 46, borderRadius: 23,
        alignItems: "center", justifyContent: "center",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 8, elevation: 3,
    },
    iconBtnEdit: { backgroundColor: colors.primary, shadowColor: colors.primary },
    iconBtnDelete: { backgroundColor: colors.danger, shadowColor: colors.danger },
    iconBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
