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

function SectionDivider() {
    return (
        <View style={divStyles.divider}>
            <View style={divStyles.dividerLine} />
            <View style={divStyles.dividerDot} />
            <View style={divStyles.dividerLine} />
        </View>
    );
}

const divStyles = StyleSheet.create({
    divider: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginVertical: 8 },
    dividerLine: { flex: 1, height: 1, backgroundColor: "#2a3544", opacity: 0.7 },
    dividerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#2a3544", marginHorizontal: 12 },
});
import {
    AppealStatusBadge,
    Button,
    Card,
    ScreenLayout,
    VerificationWall,
} from "../../components/ui";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import { buildBuildingKey } from "../../utils/buildingKey";
import {
    collectiveUniqueApartmentCount,
    isArchivedAppeal,
    MASS_APPEAL_THRESHOLD,
} from "../../utils/appeals";
import { colors, spacing, textStyles } from "../../theme";

type Props = AppealsScreenProps<"AppealDetail">;

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

    const onDelete = () => {
        Alert.alert("Удалить обращение?", "Действие нельзя отменить.", [
            { text: "Отмена", style: "cancel" },
            {
                text: "Удалить",
                style: "destructive",
                onPress: () => { deleteAppeal(item.id); goBack(); },
            },
        ]);
    };

    const onJoin = () => {
        void joinAppeal(item.id);
    };

    return (
        <ScreenLayout title="Обращение" scroll onBack={goBack}>
            <Card>
                <View style={styles.top}>
                    <AppealStatusBadge status={item.status} />
                    {item.kind === "collective" && (
                        <View style={styles.kindBadge}>
                            <Text style={styles.kindBadgeText}>Коллективное</Text>
                        </View>
                    )}
                </View>
                {item.kind === "collective" && (
                    <Text style={[textStyles.caption, styles.threshold]}>
                        Квартир в подъезде {item.entrance ?? "—"}: {uniqueCount} из{" "}
                        {MASS_APPEAL_THRESHOLD} — при пороге статус «Принято», передача в УК
                    </Text>
                )}
                {item.kind === "collective" && isAuthor && (
                    <Text style={[textStyles.caption, styles.joinExplainer]}>
                        Соседи могут присоединиться со своего аккаунта: в профиле должен
                        быть тот же дом, что у вас, и статус верификации «Подтверждён».
                    </Text>
                )}
                {item.escalatedToUk && (
                    <Text style={[textStyles.caption, styles.esc]}>Передано в УК (эскалация)</Text>
                )}
                <Text style={[textStyles.caption, styles.meta]}>
                    {item.category} · {formatDate(item.createdAt)}
                </Text>
                <Text style={[textStyles.title, styles.title]}>{item.title}</Text>
                <Text style={[textStyles.body, styles.body]}>{item.body}</Text>
                {item.imageUrls.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
                        {item.imageUrls.map((uri, i) => (
                            <Image key={i} source={{ uri }} style={styles.img} />
                        ))}
                    </ScrollView>
                )}
            </Card>

            <SectionDivider />

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
                                    <Text style={[textStyles.body, styles.partTd, styles.partTdApt]}>
                                        {p.apartment}
                                    </Text>
                                    <Text style={[textStyles.caption, styles.partTd, styles.partTdDate]}>
                                        {formatDate(p.joinedAt)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {canJoin && (
                <View style={styles.joinBlock}>
                    <Button title="Присоединиться" onPress={onJoin} />
                    <Text style={[textStyles.caption, styles.joinExplainer]}>
                        Это действие выполняется под вашим логином; другой человек
                        присоединится со своего устройства и своего профиля.
                    </Text>
                </View>
            )}
            {item.kind === "collective" && !isAuthor && user && verified && !alreadyJoined && !sameHouseAsAppeal && (
                <Text style={[textStyles.caption, styles.warn]}>
                    Адрес дома в вашем профиле не совпадает с этим обращением — присоединиться нельзя.
                </Text>
            )}
            {item.kind === "collective" && !isAuthor && user && alreadyJoined && (
                <Text style={[textStyles.caption, styles.joinedNote]}>
                    Вы уже среди участников этого обращения.
                </Text>
            )}
            {item.kind === "collective" && !isAuthor && user && !verified && (
                <VerificationWall message="Присоединиться к коллективному обращению могут только верифицированные жильцы." />
            )}

            {isAuthor && (item.status === "resolved" || item.status === "rejected") && !isArchivedAppeal(item) ? (
                <View style={styles.authorBtns}>
                    <Button
                        title="Добавить в архив"
                        variant="secondary"
                        onPress={() => { archiveAppeal(item.id); goBack(); }}
                    />
                </View>
            ) : isAuthor && !isArchivedAppeal(item) ? (
                <View style={styles.authorBtns}>
                    <Pressable
                        onPress={() => {
                            Alert.alert(
                                "Редактирование",
                                "При редактировании все данные и результаты сбросятся, статус вернётся к «Новое». Продолжить?",
                                [
                                    { text: "Отмена", style: "cancel" },
                                    { text: "Продолжить", onPress: () => navigation.navigate("AppealNew", { editId: item.id }) },
                                ],
                            );
                        }}
                        hitSlop={10}
                        style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
                    >
                        <Ionicons name="create-outline" size={20} color={colors.bg} />
                    </Pressable>
                    <Pressable
                        onPress={onDelete}
                        hitSlop={10}
                        style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.bg} />
                    </Pressable>
                </View>
            ) : null}
        </ScreenLayout>
    );
}

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("ru-RU");
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    imgRow: { marginTop: spacing.md },
    img: {
        width: 240,
        height: 160,
        borderRadius: 8,
        backgroundColor: colors.border,
        marginRight: spacing.sm,
    },
    miss: { color: colors.textMuted },
    top: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginBottom: spacing.sm,
        alignItems: "center",
    },
    kindTag: { color: colors.info, fontWeight: "600" },
    kindBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "rgba(251, 191, 36, 0.15)",
    },
    kindBadgeText: { fontSize: 11, fontWeight: "600", color: "#fbbf24" },
    partTable: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: colors.surface,
    },
    partTr: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    partTrHead: { backgroundColor: colors.bgElevated, borderBottomColor: colors.border },
    partTrLast: { borderBottomWidth: 0 },
    partTrMe: { backgroundColor: "rgba(61, 158, 122, 0.08)" },
    partTh: { color: colors.textDim, fontWeight: "600" },
    partTd: { color: colors.text },
    partTdApt: { width: 72, textAlign: "center" },
    partTdDate: { width: 80, textAlign: "right", color: colors.textDim, fontSize: 11 },
    joinBlock: { gap: spacing.sm, marginTop: spacing.md },
    joinExplainer: { color: colors.textDim, lineHeight: 20 },
    joinedNote: { color: colors.primary, marginTop: spacing.md, lineHeight: 20 },
    threshold: { color: colors.textDim, marginBottom: spacing.sm },
    esc: { color: colors.warning, marginBottom: spacing.sm },
    meta: { color: colors.textMuted },
    title: { color: colors.text, marginTop: spacing.sm },
    body: { color: colors.text, marginTop: spacing.md },
    block: { marginTop: spacing.lg },
    blockTitle: { color: colors.textMuted, marginBottom: spacing.sm },
    partRow: {
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    partName: { color: colors.text },
    warn: { color: colors.warning, marginTop: spacing.md, lineHeight: 20 },
    authorBtns: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    editBtn: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: colors.primary,
        alignItems: "center", justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 8, elevation: 3,
    },
    editBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    deleteBtn: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: colors.danger,
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: "#f08b8b",
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 8, elevation: 3,
    },
    deleteBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});
