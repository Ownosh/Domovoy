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
    const canJoin =
        item.kind === "collective" &&
        !isAuthor &&
        user &&
        !alreadyJoined &&
        verified &&
        sameHouseAsAppeal;

    const statusColor = appealStatusColor[item.status] ?? colors.textMuted;
    const steps = getAppealSteps(item.kind, item.status);

    const onDelete = () => {
        Alert.alert("Удалить обращение?", "Действие нельзя отменить.", [
            { text: "Отмена", style: "cancel" },
            { text: "Удалить", style: "destructive", onPress: () => { deleteAppeal(item.id); goBack(); } },
        ]);
    };

    return (
        <ScreenLayout title={item.kind === "collective" ? "Коллективное обращение" : "Обращение"} scroll onBack={goBack}>

            {/* ── Лента статусов ───────────────────────────── */}
            <View style={styles.timelineWrap}>
                <StatusTimeline steps={steps} currentKey={item.status} />
            </View>

            {/* ── Основная карточка ────────────────────────── */}
            <Card style={[styles.mainCard, { borderLeftColor: statusColor }]}>
                {/* Строка: статус + дата */}
                <View style={styles.topRow}>
                    <View style={styles.topLeft}>
                        <AppealStatusBadge status={item.status} />
                        {item.kind === "collective" && (
                            <View style={styles.kindBadge}>
                                <Text style={styles.kindBadgeText}>Коллективное</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>

                {/* Тема */}
                <Text style={[textStyles.title, styles.title]}>{item.title}</Text>

                {/* Фотографии */}
                {item.imageUrls.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
                        {item.imageUrls.map((uri, i) => (
                            <Image key={i} source={{ uri }} style={styles.img} />
                        ))}
                    </ScrollView>
                )}

                {/* Разделитель */}
                <View style={styles.divider} />

                {/* Категория + дата */}
                <Text style={[textStyles.caption, styles.meta]}>{item.category}</Text>

                {/* Описание */}
                <Text style={[textStyles.body, styles.body]}>{item.body}</Text>

                {item.escalatedToUk && (
                    <Text style={[textStyles.caption, styles.esc]}>Передано в УК (эскалация)</Text>
                )}
                {item.kind === "collective" && (
                    <Text style={[textStyles.caption, styles.threshold]}>
                        Квартир в подъезде {item.entrance ?? "—"}: {uniqueCount} из {MASS_APPEAL_THRESHOLD}
                    </Text>
                )}
            </Card>

            {/* ── Кнопки редактирования/удаления ──────────── */}
            {isAuthor && !isArchivedAppeal(item) && (
                <View style={styles.actionsRow}>
                    {(item.status === "resolved" || item.status === "rejected" || item.status === "closed") && (
                        <Button
                            title="В архив"
                            variant="secondary"
                            onPress={() => { archiveAppeal(item.id); goBack(); }}
                            style={styles.archiveBtn}
                        />
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

            {/* ── Комментарий от УК ────────────────────────── */}
            {item.adminComment ? (
                <View style={styles.adminBlock}>
                    <View style={styles.adminHeader}>
                        <Ionicons name="chatbox-ellipses" size={16} color={colors.warning} />
                        <Text style={[textStyles.label, styles.adminTitle]}>Комментарий от УК</Text>
                        {item.adminCommentAt && (
                            <Text style={styles.adminDate}>{formatDate(item.adminCommentAt)}</Text>
                        )}
                    </View>
                    <Text style={[textStyles.body, styles.adminText]}>{item.adminComment}</Text>
                </View>
            ) : null}

            {/* ── Участники (коллективное) ──────────────────── */}
            {item.kind === "collective" && item.participants.length > 0 && (
                <View style={styles.block}>
                    <Text style={[textStyles.label, styles.blockTitle]}>
                        Присоединились ({item.participants.length})
                    </Text>
                    <View style={styles.partTable}>
                        <View style={[styles.partTr, styles.partTrHead]}>
                            <Text style={[textStyles.caption, styles.partTh, { flex: 1 }]}>Житель</Text>
                            <Text style={[textStyles.caption, styles.partTh, styles.partTdApt]}>Квартира</Text>
                            <Text style={[textStyles.caption, styles.partTh, styles.partTdDate]}>Дата</Text>
                        </View>
                        {item.participants.map((p, idx) => {
                            const isLast = idx === item.participants.length - 1;
                            const isMe = String(p.userId) === String(user?.id);
                            return (
                                <View key={`${p.userId}_${p.joinedAt}`} style={[styles.partTr, isLast && styles.partTrLast, isMe && styles.partTrMe]}>
                                    <Text style={[textStyles.body, styles.partTd, { flex: 1 }]}>
                                        {isMe ? "Вы" : (p.displayName || `Житель …${String(p.userId).slice(-4)}`)}
                                    </Text>
                                    <Text style={[textStyles.body, styles.partTd, styles.partTdApt]}>{p.apartment}</Text>
                                    <Text style={[textStyles.caption, styles.partTd, styles.partTdDate]}>{formatDate(p.joinedAt)}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* ── Кнопка «Присоединиться» ──────────────────── */}
            {canJoin && (
                <View style={styles.joinBlock}>
                    <Button title="Присоединиться" onPress={() => void joinAppeal(item.id)} />
                    <Text style={[textStyles.caption, styles.joinNote]}>
                        Это действие выполняется под вашим логином.
                    </Text>
                </View>
            )}
            {item.kind === "collective" && !isAuthor && user && alreadyJoined && (
                <Text style={[textStyles.caption, styles.joinedNote]}>Вы уже среди участников.</Text>
            )}
            {item.kind === "collective" && !isAuthor && user && !verified && (
                <VerificationWall message="Присоединиться могут только верифицированные жильцы." />
            )}
        </ScreenLayout>
    );
}

function formatDate(iso: string) {
    try { return new Date(iso).toLocaleString("ru-RU"); } catch { return iso; }
}

const styles = StyleSheet.create({
    miss: { color: colors.textMuted },
    timelineWrap: {
        marginHorizontal: -spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        marginBottom: spacing.md,
    },
    mainCard: {
        borderLeftWidth: 3,
        gap: spacing.sm,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    topLeft: { flexDirection: "row", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" },
    date: { fontSize: 12, color: colors.textDim },
    kindBadge: {
        paddingHorizontal: spacing.sm, paddingVertical: 3,
        borderRadius: 6, backgroundColor: "rgba(251,191,36,0.15)",
    },
    kindBadgeText: { fontSize: 11, fontWeight: "600", color: "#fbbf24" },
    title: { color: colors.text },
    imgRow: { marginTop: spacing.sm },
    img: { width: 240, height: 160, borderRadius: radius.md, backgroundColor: colors.border, marginRight: spacing.sm },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.sm },
    meta: { color: colors.textMuted },
    body: { color: colors.text, lineHeight: 22 },
    esc: { color: colors.warning, marginTop: spacing.xs },
    threshold: { color: colors.textDim, marginTop: spacing.xs },
    actionsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: spacing.md,
        marginTop: spacing.md,
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
    block: { marginTop: spacing.lg },
    blockTitle: { color: colors.textMuted, marginBottom: spacing.sm },
    partTable: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
    partTr: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
    partTrHead: { backgroundColor: colors.bgElevated, borderBottomColor: colors.border },
    partTrLast: { borderBottomWidth: 0 },
    partTrMe: { backgroundColor: "rgba(61,158,122,0.08)" },
    partTh: { color: colors.textDim, fontWeight: "600" },
    partTd: { color: colors.text },
    partTdApt: { width: 72, textAlign: "center" },
    partTdDate: { width: 80, textAlign: "right", color: colors.textDim, fontSize: 11 },
    joinBlock: { gap: spacing.sm, marginTop: spacing.md },
    joinNote: { color: colors.textDim, lineHeight: 18 },
    joinedNote: { color: colors.primary, marginTop: spacing.md },
});
