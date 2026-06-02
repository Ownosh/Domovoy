import { Ionicons } from "@expo/vector-icons";
import type { CommunityScreenProps } from "../../navigation/types";
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
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"NeighborAdDetail">;

export function NeighborAdDetailScreen({ route, navigation }: Props) {
    const goBack = useModalBack();
    const { neighborAds, user, reportNeighborAd, extendNeighborAd, deleteNeighborAd } =
        useApp();
    const ad = neighborAds.find((a) => a.id === route.params.id);

    if (!ad) {
        return (
            <ScreenLayout title="Объявление" onBack={goBack}>
                <Text style={[textStyles.body, styles.miss]}>
                    Объявление не найдено
                </Text>
            </ScreenLayout>
        );
    }

    const isAuthor = String(user?.id) === String(ad.authorUserId);

    const onCall = () => {
        if (!ad.showPhone) {
            Alert.alert("Номер скрыт", "Автор не указал телефон для звонка.");
            return;
        }
        const raw = (ad.authorPhone ?? "").replace(/\D/g, "");
        if (!raw) {
            Alert.alert("Нет номера", "Автор не указал телефон для звонка.");
            return;
        }
        const tel = raw.startsWith("7") ? raw : `7${raw}`;
        Linking.openURL(`tel:+${tel}`).catch(() => {});
    };

    const onReport = () => {
        if (isAuthor) return;
        Alert.alert(
            "Жалоба",
            "Отправить объявление на проверку УК?",
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Отправить",
                    onPress: () => reportNeighborAd(ad.id),
                },
            ],
        );
    };

    return (
        <ScreenLayout
            title="Объявление"
            scroll
            onBack={goBack}
        >
            <Card>
                {ad.pendingModeration && (
                    <Text style={[textStyles.caption, styles.mod]}>
                        На проверке УК после жалобы
                    </Text>
                )}
                {ad.archived && (
                    <Text style={[textStyles.caption, styles.arch]}>
                        В архиве (истёк срок 30 дней)
                    </Text>
                )}
                <Text style={[textStyles.title, styles.title]}>{ad.title}</Text>
                <Text style={[textStyles.body, styles.body]}>{ad.body}</Text>
                {ad.imageUrl ? (
                    <Image source={{ uri: ad.imageUrl }} style={styles.img} />
                ) : null}
            </Card>

            {!isAuthor && (
                <View style={styles.actions}>
                    <Button title="Позвонить" onPress={onCall} />
                    <View style={styles.gap} />
                    <View style={styles.reportWrap}>
                        <Pressable onPress={onReport}>
                            <Text style={[textStyles.caption, styles.report]}>
                                Пожаловаться (модерация УК)
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {isAuthor && (
                <View style={styles.actions}>
                    <Button
                        title="Продлить на 30 дней"
                        onPress={() => extendNeighborAd(ad.id)}
                        variant="secondary"
                    />
                    <View style={styles.gap} />
                    <View style={styles.iconRow}>
                        <Pressable
                            hitSlop={10}
                            onPress={() => navigation.navigate("NeighborAdNew", { editId: ad.id })}
                            style={({ pressed }) => [styles.iconBtn, styles.iconBtnEdit, pressed && styles.iconBtnPressed]}
                        >
                            <Ionicons name="create-outline" size={20} color={colors.bg} />
                        </Pressable>
                        <Pressable
                            hitSlop={10}
                            onPress={() => {
                                Alert.alert("Удалить?", "", [
                                    { text: "Отмена", style: "cancel" },
                                    {
                                        text: "Удалить",
                                        style: "destructive",
                                        onPress: () => {
                                            deleteNeighborAd(ad.id);
                                            navigation.goBack();
                                        },
                                    },
                                ]);
                            }}
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
    mod: { color: colors.warning, marginBottom: spacing.sm },
    arch: { color: colors.textDim, marginBottom: spacing.sm },
    title: { color: colors.text },
    body: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 22 },
    img: {
        marginTop: spacing.md,
        width: "100%",
        height: 180,
        borderRadius: radius.md,
        backgroundColor: colors.border,
    },
    actions: { marginTop: spacing.lg },
    gap: { height: spacing.md },
    iconRow: { flexDirection: "row", gap: spacing.md },
    iconBtn: {
        width: 46, height: 46, borderRadius: 23,
        alignItems: "center", justifyContent: "center",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 8, elevation: 3,
    },
    iconBtnEdit: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
    },
    iconBtnDelete: {
        backgroundColor: colors.danger,
        shadowColor: colors.danger,
        borderWidth: 1, borderColor: "#f08b8b",
    },
    iconBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    hint: { color: colors.textDim },
    reportWrap: { alignItems: "center" },
    report: { color: colors.danger, textDecorationLine: "underline" },
});
