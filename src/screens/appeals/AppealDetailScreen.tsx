import { Ionicons } from "@expo/vector-icons";
import type { AppealsScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import {
    AppealStatusBadge,
    Button,
    Card,
    ScreenLayout,
} from "../../components/ui";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import { buildBuildingKey } from "../../utils/buildingKey";
import {
    collectiveUniqueApartmentCount,
    MASS_APPEAL_THRESHOLD,
} from "../../utils/appeals";
import { colors, spacing, textStyles } from "../../theme";

type Props = AppealsScreenProps<"AppealDetail">;

export function AppealDetailScreen({ route, navigation }: Props) {
    const { appeals, deleteAppeal, joinAppeal, verification, user, profile } =
        useApp();
    const item = appeals.find((a) => a.id === route.params.id);
    const [joinOpen, setJoinOpen] = useState(false);
    const [joinComment, setJoinComment] = useState("");
    const [joinPhotoNote, setJoinPhotoNote] = useState("");
    const [anonymous, setAnonymous] = useState(false);

    if (!item) {
        return (
            <ScreenLayout
                title="Обращение"
                onBack={() => navigation.goBack()}
            >
                <Text style={[textStyles.body, styles.miss]}>
                    Запись не найдена
                </Text>
                <Button title="Назад" onPress={() => navigation.goBack()} />
            </ScreenLayout>
        );
    }

    const isAuthor = user?.id === item.authorUserId;
    const uniqueCount = collectiveUniqueApartmentCount(item);
    const myBuildingKey = buildBuildingKey(profile.building);
    const sameHouseAsAppeal = item.buildingKey === myBuildingKey;
    const alreadyJoined =
        !!user && item.participants.some((p) => p.userId === user.id);
    const verified = isVerifiedResident(verification);
    const canJoin =
        item.kind === "collective" &&
        !isAuthor &&
        user &&
        !alreadyJoined &&
        verified &&
        sameHouseAsAppeal;

    const onDelete = () => {
        Alert.alert(
            "Удалить обращение?",
            "Действие нельзя отменить.",
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Удалить",
                    style: "destructive",
                    onPress: () => {
                        deleteAppeal(item.id);
                        navigation.popToTop();
                    },
                },
            ],
        );
    };

    const submitJoin = () => {
        const r = joinAppeal({
            appealId: item.id,
            comment: joinComment.trim() || joinPhotoNote.trim() || undefined,
            photoUri: joinPhotoNote.trim() ? `note:${joinPhotoNote.trim()}` : undefined,
            anonymous,
        });
        if (!r.ok) {
            Alert.alert("Нельзя присоединиться", "reason" in r ? r.reason : "");
            return;
        }
        setJoinOpen(false);
        setJoinComment("");
        setJoinPhotoNote("");
        Alert.alert("", "Вы присоединились к обращению");
    };

    const quickJoin = () => {
        const r = joinAppeal({
            appealId: item.id,
            anonymous: false,
        });
        if (!r.ok) {
            Alert.alert("Нельзя присоединиться", "reason" in r ? r.reason : "");
            return;
        }
        Alert.alert("", "Вы присоединились к обращению");
    };

    return (
        <ScreenLayout
            title="Обращение"
            scroll
            onBack={() => navigation.goBack()}
        >
            <Card>
                <View style={styles.top}>
                    <AppealStatusBadge status={item.status} />
                    {item.kind === "collective" && (
                        <Text style={[textStyles.caption, styles.kindTag]}>
                            Коллективное
                        </Text>
                    )}
                </View>
                {item.kind === "collective" && (
                    <Text style={[textStyles.caption, styles.threshold]}>
                        Квартир в подъезде {item.entrance ?? "—"}: {uniqueCount} из{" "}
                        {MASS_APPEAL_THRESHOLD} — при пороге статус «Принято», передача в
                        УК
                    </Text>
                )}
                {item.kind === "collective" && isAuthor && (
                    <Text style={[textStyles.caption, styles.joinExplainer]}>
                        Соседи могут присоединиться со своего аккаунта: в профиле должен
                        быть тот же дом, что у вас, и статус верификации «Подтверждён».
                    </Text>
                )}
                {item.escalatedToUk && (
                    <Text style={[textStyles.caption, styles.esc]}>
                        Передано в УК (эскалация)
                    </Text>
                )}
                <Text style={[textStyles.caption, styles.meta]}>
                    {item.category} · {formatDate(item.createdAt)}
                </Text>
                <Text style={[textStyles.title, styles.title]}>{item.title}</Text>
                <Text style={[textStyles.body, styles.body]}>{item.body}</Text>
            </Card>

            {item.kind === "collective" && item.participants.length > 0 && (
                <View style={styles.block}>
                    <Text style={[textStyles.label, styles.blockTitle]}>
                        Присоединились
                    </Text>
                    {item.participants.map((p) => (
                        <View key={`${p.userId}_${p.joinedAt}`} style={styles.partRow}>
                            <Text style={[textStyles.subtitle, styles.partName]}>
                                {p.anonymous ? "Анонимно" : p.displayName} · кв.{" "}
                                {p.apartment}
                            </Text>
                            {p.comment ? (
                                <Text style={[textStyles.caption, styles.partCmt]}>
                                    {p.comment}
                                </Text>
                            ) : null}
                            {p.photoUri?.startsWith("note:") ? (
                                <Text style={[textStyles.caption, styles.partCmt]}>
                                    Фото: {p.photoUri.slice(5)}
                                </Text>
                            ) : null}
                        </View>
                    ))}
                </View>
            )}

            {item.kind === "collective" && canJoin && (
                <View style={styles.joinBlock}>
                    <Button title="Присоединиться" onPress={quickJoin} />
                    <Pressable
                        onPress={() => setJoinOpen(true)}
                        style={({ pressed }) => [
                            styles.joinCustomize,
                            pressed && styles.joinCustomizePressed,
                        ]}
                    >
                        <Text style={[textStyles.caption, styles.joinCustomizeText]}>
                            Комментарий, фото, анонимность…
                        </Text>
                    </Pressable>
                    <Text style={[textStyles.caption, styles.joinExplainer]}>
                        Это действие выполняется под вашим логином; другой человек
                        присоединится со своего устройства и своего профиля.
                    </Text>
                </View>
            )}
            {item.kind === "collective" &&
                !isAuthor &&
                user &&
                verified &&
                !alreadyJoined &&
                !sameHouseAsAppeal && (
                    <Text style={[textStyles.caption, styles.warn]}>
                        Адрес дома в вашем профиле не совпадает с этим обращением —
                        присоединиться нельзя.
                    </Text>
                )}
            {item.kind === "collective" && !isAuthor && user && alreadyJoined && (
                <Text style={[textStyles.caption, styles.joinedNote]}>
                    Вы уже среди участников этого обращения.
                </Text>
            )}
            {item.kind === "collective" && !isAuthor && user && !verified && (
                <Text style={[textStyles.caption, styles.warn]}>
                    Присоединиться могут только жильцы с подтверждённой верификацией.
                </Text>
            )}

            {isAuthor && (
                <Pressable
                    onPress={onDelete}
                    hitSlop={10}
                    style={({ pressed }) => [
                        styles.deleteBtn,
                        pressed && styles.deleteBtnPressed,
                    ]}
                >
                    <Ionicons name="trash-outline" size={20} color={colors.bg} />
                </Pressable>
            )}

            <Modal
                visible={joinOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setJoinOpen(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setJoinOpen(false)}
                >
                    <Pressable style={styles.modalCard} onPress={() => {}}>
                        <Text style={[textStyles.subtitle, styles.modalTitle]}>
                            Участие с деталями
                        </Text>
                        <Text style={[textStyles.caption, styles.modalHint]}>
                            Анонимно, комментарий или пометка к фото (в демо без загрузки
                            файла).
                        </Text>
                        <View style={styles.switchRow}>
                            <Text style={[textStyles.body, styles.switchLabel]}>
                                Анонимно
                            </Text>
                            <Switch value={anonymous} onValueChange={setAnonymous} />
                        </View>
                        <Text style={[textStyles.caption, styles.fieldLabel]}>
                            Комментарий (необязательно)
                        </Text>
                        <TextInput
                            value={joinComment}
                            onChangeText={setJoinComment}
                            style={styles.input}
                            placeholder="Коротко, по сути"
                            multiline
                        />
                        <Text style={[textStyles.caption, styles.fieldLabel]}>
                            Фото — подпись / ссылка (демо, без загрузки файла)
                        </Text>
                        <TextInput
                            value={joinPhotoNote}
                            onChangeText={setJoinPhotoNote}
                            style={styles.input}
                            placeholder="Опционально"
                        />
                        <View style={styles.modalActions}>
                            <Button title="Готово" onPress={submitJoin} />
                            <Button
                                title="Отмена"
                                variant="secondary"
                                onPress={() => setJoinOpen(false)}
                            />
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
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
    miss: { color: colors.textMuted },
    top: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginBottom: spacing.sm,
        alignItems: "center",
    },
    kindTag: { color: colors.info, fontWeight: "600" },
    joinBlock: { gap: spacing.sm, marginTop: spacing.md },
    joinCustomize: {
        alignSelf: "center",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    joinCustomizePressed: { opacity: 0.75 },
    joinCustomizeText: { color: colors.primary, fontWeight: "600" },
    joinExplainer: {
        color: colors.textDim,
        marginTop: spacing.sm,
        lineHeight: 20,
    },
    joinedNote: {
        color: colors.primary,
        marginTop: spacing.md,
        lineHeight: 20,
    },
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
    partCmt: { color: colors.textMuted, marginTop: spacing.xs },
    warn: { color: colors.warning, marginTop: spacing.md, lineHeight: 20 },
    deleteBtn: {
        alignSelf: "flex-end",
        marginTop: spacing.lg,
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.danger,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#f08b8b",
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 3,
    },
    deleteBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        padding: spacing.lg,
    },
    modalCard: {
        backgroundColor: colors.bgElevated,
        borderRadius: 16,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    modalTitle: { color: colors.text, marginBottom: spacing.xs },
    modalHint: { color: colors.textDim, marginBottom: spacing.sm, lineHeight: 18 },
    switchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginVertical: spacing.sm,
    },
    switchLabel: { color: colors.text },
    fieldLabel: { color: colors.textDim, marginTop: spacing.sm },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: spacing.md,
        color: colors.text,
        minHeight: 44,
        textAlignVertical: "top",
    },
    modalActions: {
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
});
