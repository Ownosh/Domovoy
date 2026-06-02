import type { CommunityScreenProps } from "../../navigation/types";
import React from "react";
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
    const { neighborAds, user, reportNeighborAd, extendNeighborAd, deleteNeighborAd } =
        useApp();
    const ad = neighborAds.find((a) => a.id === route.params.id);

    if (!ad) {
        return (
            <ScreenLayout title="Объявление" onBack={() => navigation.goBack()}>
                <Text style={[textStyles.body, styles.miss]}>
                    Объявление не найдено
                </Text>
            </ScreenLayout>
        );
    }

    const isAuthor = user?.id === ad.authorUserId;

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
            onBack={() => navigation.goBack()}
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
                    <Button
                        title="Удалить"
                        variant="danger"
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
                    />
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
    hint: { color: colors.textDim },
    reportWrap: { alignItems: "center" },
    report: { color: colors.danger, textDecorationLine: "underline" },
});
