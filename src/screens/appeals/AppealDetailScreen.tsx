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
import { APPEAL_CATEGORY_LABELS } from "../../constants/appealCategories";
import { buildBuildingKey } from "../../utils/buildingKey";
import {
    collectiveUniqueApartmentCount,
    isArchivedAppeal,
    MASS_APPEAL_THRESHOLD,
    OWNERS_MEETING_CATEGORY,
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
    const { appeals, deleteAppeal, archiveAppeal, markAppealCommentRead, joinAppeal, verification, user, profile } = useApp();
    const goBack = useModalBack();
    const item = appeals.find((a) => a.id === route.params.id);

    React.useEffect(() => {
        if (item?.adminComment && !item.adminCommentRead) {
            markAppealCommentRead(item.id);
        }
    }, [item?.id, item?.adminComment, item?.adminCommentRead]);

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
    const isOwnersMeeting = item.category === OWNERS_MEETING_CATEGORY;
    const isOwner = isVerifiedOwner(verification);
    const canJoin = item.kind === "collective" && !isAuthor && user && !alreadyJoined && verified && sameHouseAsAppeal
        && (!isOwnersMeeting || isOwner);

    const statusColor = appealStatusColor[item.status] ?? colors.textMuted;
    const steps = getAppealSteps(item.kind, item.status);
    const progress = Math.min(uniqueCount / MASS_APPEAL_THRESHOLD, 1);

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
                            <View style={[styles.collectiveBadge, { borderColor: `${statusColor}44`, backgroundColor: `${statusColor}0d` }]}>
                                <Ionicons name="people-outline" size={12} color={statusColor} />
                                <Text style={[styles.collectiveBadgeText, { color: statusColor }]}>Коллективное</Text>
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
                <Text style={[textStyles.caption, styles.meta]}>
                    {item.categoryLabel ?? APPEAL_CATEGORY_LABELS[item.category as keyof typeof APPEAL_CATEGORY_LABELS] ?? item.category}
                </Text>
                <Text style={[textStyles.body, styles.body]}>{item.body}</Text>

                {item.escalatedToUk && (
                    <View style={styles.escRow}>
                        <Ionicons name="business-outline" size={14} color={statusColor} />
                        <Text style={[textStyles.caption, styles.escText, { color: statusColor }]}>Передано в УК</Text>
                    </View>
                )}
            </Card>

            {/* ── Прогресс сбора подписей (только коллективное) ── */}
            {item.kind === "collective" && (
                <Card style={[styles.progressCard, { borderLeftColor: statusColor }]}>
                    <View style={styles.progressHeader}>
                        <Ionicons name="people-outline" size={18} color={statusColor} />
                        <Text style={[textStyles.label, styles.progressTitle]}>Сбор подписей</Text>
                        <Text style={[textStyles.subtitle, { color: statusColor }]}>
                            {uniqueCount} / {MASS_APPEAL_THRESHOLD}
                        </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any, backgroundColor: statusColor }]} />
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
                    <View style={styles.sectionHeader}>
                        <Ionicons name="people-outline" size={15} color={statusColor} />
                        <Text style={[textStyles.label, styles.sectionTitle, { color: statusColor }]}>
                            Присоединились
                        </Text>
                        <View style={[styles.countBadge, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}33` }]}>
                            <Text style={[styles.countBadgeText, { color: statusColor }]}>{item.participants.length}</Text>
                        </View>
                    </View>
                    <Card style={[styles.participantsCard, { borderLeftColor: statusColor }]}>
                        {item.participants.map((p, idx) => {
                            const isMe = String(p.userId) === String(user?.id);
                            const name = isMe ? "Вы" : (p.displayName || `Житель …${String(p.userId).slice(-4)}`);
                            const initials = (p.displayName || "Ж").charAt(0).toUpperCase();
                            const isLast = idx === item.participants.length - 1;
                            return (
                                <View key={`${p.userId}_${p.joinedAt}`}>
                                    <View style={[
                                        styles.participantRow,
                                        isMe && { backgroundColor: `${statusColor}08` },
                                    ]}>
                                        {/* Аватар */}
                                        {p.photoUri ? (
                                            <AvatarThumb name={p.displayName || "Житель"} photo={p.photoUri} size={38} />
                                        ) : (
                                            <View style={[
                                                styles.avatarCircle,
                                                isMe
                                                    ? { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }
                                                    : { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
                                            ]}>
                                                <Text style={[styles.avatarInitial, { color: isMe ? statusColor : colors.textMuted }]}>
                                                    {initials}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Имя + комментарий */}
                                        <View style={styles.participantInfo}>
                                            <View style={styles.participantNameRow}>
                                                <Text style={[textStyles.body, styles.participantName, isMe && { color: statusColor }]}>
                                                    {name}
                                                </Text>
                                                {isMe && (
                                                    <Ionicons name="checkmark-circle" size={14} color={statusColor} />
                                                )}
                                            </View>
                                            {p.comment ? (
                                                <Text style={[textStyles.caption, styles.participantComment]} numberOfLines={1}>
                                                    {p.comment}
                                                </Text>
                                            ) : null}
                                        </View>

                                        {/* Кв + дата */}
                                        <View style={styles.participantRight}>
                                            <View style={[styles.aptBadge, isMe && { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}44` }]}>
                                                <Text style={[styles.aptText, isMe && { color: statusColor }]}>кв. {p.apartment}</Text>
                                            </View>
                                            <Text style={styles.participantDate}>{formatShortDate(p.joinedAt)}</Text>
                                        </View>
                                    </View>
                                    {!isLast && <View style={styles.participantDivider} />}
                                </View>
                            );
                        })}
                    </Card>
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
                <View style={[styles.joinedRow, { backgroundColor: `${statusColor}0d`, borderColor: `${statusColor}33` }]}>
                    <Ionicons name="checkmark-circle" size={18} color={statusColor} />
                    <Text style={[textStyles.caption, styles.joinedNote, { color: statusColor }]}>Вы уже присоединились к этому обращению</Text>
                </View>
            )}
            {item.kind === "collective" && !isAuthor && user && !verified && (
                <VerificationWall message="Присоединиться могут только верифицированные жильцы." />
            )}
            {item.kind === "collective" && !isAuthor && user && verified && !alreadyJoined && isOwnersMeeting && !isOwner && (
                <VerificationWall message="Присоединиться к инициативе собрания собственников могут только верифицированные собственники." />
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
        borderRadius: 6, borderWidth: 1,
    },
    collectiveBadgeText: { fontSize: 11, fontWeight: "600" },
    title: { color: colors.text },
    imgRow: { marginTop: spacing.sm },
    img: { width: 240, height: 160, borderRadius: radius.md, backgroundColor: colors.border, marginRight: spacing.sm },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.sm },
    meta: { color: colors.textMuted },
    body: { color: colors.text, lineHeight: 22 },
    escRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    escText: {},

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
    section: { marginTop: spacing.lg, gap: spacing.sm },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sectionTitle: { flex: 1 },
    countBadge: {
        paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: radius.full, borderWidth: 1,
    },
    countBadgeText: { fontSize: 12, fontWeight: "700" },
    participantsCard: {
        borderLeftWidth: 3,
        paddingHorizontal: 0,
        paddingVertical: 0,
        overflow: "hidden",
    },
    participantRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    avatarCircle: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: "center", justifyContent: "center",
        borderWidth: 1.5, flexShrink: 0,
    },
    avatarInitial: { fontSize: 15, fontWeight: "700" },
    participantNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    participantInfo: { flex: 1 },
    participantName: { color: colors.text, fontWeight: "600" },
    participantComment: { color: colors.textDim, marginTop: 2 },
    participantRight: { alignItems: "flex-end", gap: 4 },
    aptBadge: {
        paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: radius.full, borderWidth: 1,
        backgroundColor: colors.surface, borderColor: colors.borderSubtle,
    },
    aptText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
    participantDate: { fontSize: 11, color: colors.textDim },
    participantDivider: { height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: spacing.md },

    // Join
    joinBlock: { gap: spacing.sm, marginTop: spacing.lg },
    joinBtn: { borderRadius: 999, paddingHorizontal: 28 },
    joinNote: { color: colors.textDim, lineHeight: 18 },
    joinedRow: {
        flexDirection: "row", alignItems: "center", gap: spacing.sm,
        marginTop: spacing.md, padding: spacing.md,
        borderRadius: radius.md, borderWidth: 1,
    },
    joinedNote: {},

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
