import { Ionicons } from "@expo/vector-icons";
import type { AppealsScreenProps } from "../../navigation/types";
import React from "react";
import { useNavigation } from "@react-navigation/native";

function useModalBack() {
    const nav = useNavigation();
    const parentRouteNames = nav.getParent()?.getState()?.routeNames;
    const isModal = parentRouteNames?.includes("Main");
    return () => isModal ? nav.getParent()?.goBack() : nav.goBack();
}

import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    AppealStatusBadge,
    AvatarThumb,
    Button,
    Card,
    ScreenLayout,
    StatusTimeline,
    VerificationWall,
} from "../../components/ui";
import { appealLabels, appealStatusColor } from "../../components/ui/StatusBadge";
import type { TimelineStep } from "../../components/ui/StatusTimeline";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import { buildBuildingKey } from "../../utils/buildingKey";
import {
    collectiveUniqueApartmentCount,
    isArchivedAppeal,
    MASS_APPEAL_THRESHOLD,
} from "../../utils/appeals";
import { colors, radius, spacing, textStyles } from "../../theme";
import type { AppealKind, AppealStatus } from "../../types";

type Props = AppealsScreenProps<"AppealDetail">;

const PERSONAL_CHAIN: AppealStatus[] = ["new", "in_progress", "resolved", "closed"];
const COLLECTIVE_CHAIN: AppealStatus[] = ["new", "collecting_signatures", "in_progress", "resolved", "closed"];

const appealIcons: Partial<Record<AppealStatus, keyof typeof Ionicons.glyphMap>> = {
    new: "radio-button-on-outline",
    collecting_signatures: "people-outline",
    in_progress: "build-outline",
    resolved: "play-forward-outline",
    closed: "archive-outline",
    rejected: "close-circle-outline",
};

function getAppealSteps(kind: AppealKind, status: AppealStatus): TimelineStep[] {
    const base = kind === "collective" ? COLLECTIVE_CHAIN : PERSONAL_CHAIN;
    const steps: TimelineStep[] = base.map((s) => ({
        key: s,
        label: appealLabels[s] ?? s,
        color: appealStatusColor[s] ?? colors.textMuted,
        icon: appealIcons[s],
    }));
    if (!base.includes(status)) {
        steps.push({ key: status, label: appealLabels[status] ?? status, color: appealStatusColor[status] ?? colors.danger, icon: appealIcons[status] });
    }
    return steps;
}

function formatDate(iso: string) {
    try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}
function formatShortDate(iso: string) {
    try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); } catch { return iso; }
}

export function AppealDetailScreen({ route, navigation }: Props) {
    const { appeals, deleteAppeal, archiveAppeal, joinAppeal, verification, user, profile } = useApp();
    const goBack = useModalBack();
    const item = appeals.find((a) => a.id === route.params.id);

    if (!item) {
        return (
            <ScreenLayout title="Обращение" onBack={goBack}>
                <Text style={[textStyles.body, styles.miss]}>Запись не найдена</Text>
                <Button title="Назад" onPress={goBack} />
            </ScreenLayout>
        );
    }

    const isAuthor = String(user?.id) === String(item.authorUserId);
    const uniqueCount = collectiveUniqueApartmentCount(item);
    const myBuildingKey = buildBuildingKey(profile.building);
    const sameHouseAsAppeal = item.buildingKey.toLowerCase() === myBuildingKey.toLowerCase();
    const alreadyJoined = !!user && item.participants.some((p) => String(p.userId) === String(user.id));
    const verified = isVerifiedResident(verification);
    const canJoin = item.kind === "collective" && !isAuthor && user && !alreadyJoined && verified && sameHouseAsAppeal;

    const statusColor = appealStatusColor[item.status] ?? colors.textMuted;
    const steps = getAppealSteps(item.kind, item.status);
    const progress = Math.min(uniqueCount / MASS_APPEAL_THRESHOLD, 1);
    const progressColor = progress >= 1 ? colors.primary : colors.warning;

    const onDelete = () => {
        Alert.alert("Удалить обращение?", "Действие нельзя отменить.", [
            { text: "Отмена", style: "cancel" },
            { text: "Удалить", style: "destructive", onPress: () => { deleteAppeal(item.id); goBack(); } },
        ]);
    };

    return (
        <ScreenLayout
            title={item.kind === "collective" ? "Коллективное обращение" : "Обращение"}
            scroll
            onBack={goBack}
        >
            {/* ── Лента статусов ── */}
            <View style={styles.timelineWrap}>
                <StatusTimeline steps={steps} currentKey={item.status} />
            </View>

            {/* ── Основная карточка ── */}
            <Card style={[styles.mainCard, { borderLeftColor: statusColor }]}>
                <View style={styles.topRow}>
                    <View style={styles.topLeft}>
                        <AppealStatusBadge status={item.status} />
                        {item.kind === "collective" && (
                            <View style={styles.collectiveBadge}>
                                <Ionicons name="people-outline" size={12} color={colors.warning} />
                                <Text style={styles.collectiveBadgeText}>Коллективное</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>

                <Text style={[textStyles.title, styles.title]}>{item.title}</Text>

                {item.imageUrls.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
                        {item.imageUrls.map((uri, i) => (
                            <Image key={i} source={{ uri }} style={styles.img} />
                        ))}
                    </ScrollView>
                )}

                <View style={styles.divider} />
                <Text style={[textStyles.caption, styles.meta]}>{item.category}</Text>
                <Text style={[textStyles.body, styles.body]}>{item.body}</Text>

                {item.escalatedToUk && (
                    <View style={styles.escRow}>
                        <Ionicons name="business-outline" size={14} color={colors.primary} />
                        <Text style={[textStyles.caption, styles.escText]}>Передано в УК</Text>
                    </View>
                )}
            </Card>

            {/* ── Прогресс сбора подписей (только коллективное) ── */}
            {item.kind === "collective" && (
                <Card style={[styles.progressCard, { borderLeftColor: progressColor }]}>
                    <View style={styles.progressHeader}>
                        <Ionicons name="people-outline" size={18} color={progressColor} />
                        <Text style={[textStyles.label, styles.progressTitle]}>Сбор подписей</Text>
                        <Text style={[textStyles.subtitle, { color: progressColor }]}>
                            {uniqueCount} / {MASS_APPEAL_THRESHOLD}
                        </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any, backgroundColor: progressColor }]} />
                    </View>
                    <Text style={[textStyles.caption, styles.progressSub]}>
                        {progress >= 1
                            ? "Порог достигнут — обращение передано в УК"
                            : `Нужно ещё ${MASS_APPEAL_THRESHOLD - uniqueCount} кв. в подъезде ${item.entrance ?? "—"}`}
                    </Text>
                </Card>
            )}

            {/* ── Участники ── */}
            {item.kind === "collective" && item.participants.length > 0 && (
                <View style={styles.section}>
                    <Text style={[textStyles.label, styles.sectionTitle]}>
                        Присоединились · {item.participants.length}
                    </Text>
                    <View style={styles.participantsList}>
                        {item.participants.map((p, idx) => {
                            const isMe = String(p.userId) === String(user?.id);
                            const name = isMe ? "Вы" : (p.displayName || `Житель …${String(p.userId).slice(-4)}`);
                            return (
                                <View
                                    key={`${p.userId}_${p.joinedAt}`}
                                    style={[styles.participantRow, isMe && styles.participantRowMe]}
                                >
                                    <AvatarThumb name={p.displayName || "Житель"} photo={p.photoUri} size={36} />
                                    <View style={styles.participantInfo}>
                                        <Text style={[textStyles.body, styles.participantName]}>{name}</Text>
                                        {p.comment ? (
                                            <Text style={[textStyles.caption, styles.participantComment]} numberOfLines={1}>{p.comment}</Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.participantRight}>
                                        <Text style={styles.participantApt}>кв. {p.apartment}</Text>
                                        <Text style={styles.participantDate}>{formatShortDate(p.joinedAt)}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* ── Кнопка «Присоединиться» ── */}
            {canJoin && (
                <View style={styles.joinBlock}>
                    <Button title="Присоединиться к обращению" variant="accent" onPress={() => void joinAppeal(item.id)} style={styles.joinBtn} />
                    <Text style={[textStyles.caption, styles.joinNote]}>
                        Ваша квартира будет учтена в счётчике. Действие выполняется под вашим логином.
                    </Text>
                </View>
            )}
            {item.kind === "collective" && !isAuthor && user && alreadyJoined && (
                <View style={styles.joinedRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    <Text style={[textStyles.caption, styles.joinedNote]}>Вы уже присоединились к этому обращению</Text>
                </View>
            )}
            {item.kind === "collective" && !isAuthor && user && !verified && (
                <VerificationWall message="Присоединиться могут только верифицированные жильцы." />
            )}

            {/* ── Комментарий от УК ── */}
            {item.adminComment ? (
                <View style={styles.adminBlock}>
                    <View style={styles.adminHeader}>
                        <Ionicons name="chatbox-ellipses" size={16} color={colors.warning} />
                        <Text style={[textStyles.label, styles.adminTitle]}>Комментарий от УК</Text>
                        {item.adminCommentAt && (
                            <Text style={styles.adminDate}>{formatShortDate(item.adminCommentAt)}</Text>
                        )}
                    </View>
                    <Text style={[textStyles.body, styles.adminText]}>{item.adminComment}</Text>
                </View>
            ) : null}

            {/* ── Действия автора ── */}
            {isAuthor && !isArchivedAppeal(item) && (
                <View style={styles.actionsRow}>
                    {(item.status === "resolved" || item.status === "rejected" || item.status === "closed") && (
                        <Button title="В архив" variant="secondary" onPress={() => { archiveAppeal(item.id); goBack(); }} style={styles.archiveBtn} />
                    )}
                    <View style={styles.iconBtns}>
                        <Pressable
                            hitSlop={10}
                            onPress={() => Alert.alert(
                                "Редактирование",
                                "При редактировании статус вернётся к «Новое». Продолжить?",
                                [
                                    { text: "Отмена", style: "cancel" },
                                    { text: "Продолжить", onPress: () => navigation.navigate("AppealNew", { editId: item.id }) },
                                ],
                            )}
                            style={({ pressed }) => [styles.iconBtn, styles.iconBtnEdit, pressed && styles.iconBtnPressed]}
                        >
                            <Ionicons name="create-outline" size={20} color="#fff" />
                        </Pressable>
                        <Pressable
                            hitSlop={10}
                            onPress={onDelete}
                            style={({ pressed }) => [styles.iconBtn, styles.iconBtnDelete, pressed && styles.iconBtnPressed]}
                        >
                            <Ionicons name="trash-outline" size={20} color="#fff" />
                        </Pressable>
                    </View>
                </View>
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    miss: { color: colors.textMuted },

    // Timeline
    timelineWrap: {
        marginHorizontal: -spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        marginBottom: spacing.md,
    },

    // Main card
    mainCard: { borderLeftWidth: 3, gap: spacing.sm },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
    topLeft: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
    date: { fontSize: 12, color: colors.textDim },
    collectiveBadge: {
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: spacing.sm, paddingVertical: 3,
        borderRadius: 6, backgroundColor: "rgba(232,162,61,0.15)",
    },
    collectiveBadgeText: { fontSize: 11, fontWeight: "600", color: colors.warning },
    title: { color: colors.text },
    imgRow: { marginTop: spacing.sm },
    img: { width: 240, height: 160, borderRadius: radius.md, backgroundColor: colors.border, marginRight: spacing.sm },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.sm },
    meta: { color: colors.textMuted },
    body: { color: colors.text, lineHeight: 22 },
    escRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    escText: { color: colors.primary },

    // Progress card
    progressCard: {
        marginTop: spacing.md,
        gap: spacing.sm,
        borderLeftWidth: 3,
    },
    progressHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    progressTitle: { flex: 1, color: colors.text },
    progressBarBg: {
        height: 6,
        backgroundColor: colors.borderSubtle,
        borderRadius: 3,
        overflow: "hidden",
    },
    progressBarFill: { height: 6, borderRadius: 3 },
    progressSub: { color: colors.textDim },

    // Participants
    section: { marginTop: spacing.lg },
    sectionTitle: { color: colors.textMuted, marginBottom: spacing.md },
    participantsList: { gap: spacing.sm },
    participantRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: spacing.md,
    },
    participantRowMe: {
        borderColor: `${colors.primary}55`,
        backgroundColor: `${colors.primary}0a`,
    },
    participantInfo: { flex: 1 },
    participantName: { color: colors.text, fontWeight: "600" },
    participantComment: { color: colors.textDim, marginTop: 2 },
    participantRight: { alignItems: "flex-end", gap: 2 },
    participantApt: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    participantDate: { fontSize: 11, color: colors.textDim },

    // Join
    joinBlock: { gap: spacing.sm, marginTop: spacing.lg },
    joinBtn: { borderRadius: 999, paddingHorizontal: 28 },
    joinNote: { color: colors.textDim, lineHeight: 18 },
    joinedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
    joinedNote: { color: colors.primary },

    // Admin comment
    adminBlock: {
        backgroundColor: `${colors.warning}0d`,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.warning}33`,
        padding: spacing.lg,
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    adminHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    adminTitle: { color: colors.warning, flex: 1 },
    adminDate: { fontSize: 11, color: colors.textDim },
    adminText: { color: colors.text, lineHeight: 22 },

    // Author actions
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: spacing.md,
        marginTop: spacing.lg,
    },
    archiveBtn: { alignSelf: "flex-end", borderRadius: 999, paddingHorizontal: 20 },
    iconBtns: { flexDirection: "row", gap: spacing.sm },
    iconBtn: {
        width: 46, height: 46, borderRadius: 23,
        alignItems: "center", justifyContent: "center",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 8, elevation: 3,
    },
    iconBtnEdit: { backgroundColor: colors.primary, shadowColor: colors.primary },
    iconBtnDelete: { backgroundColor: colors.danger, shadowColor: colors.danger, borderWidth: 1, borderColor: "#f08b8b" },
    iconBtnPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
});
