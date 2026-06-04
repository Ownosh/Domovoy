import type { CommunityScreenProps } from "../../navigation/types";
import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, Input, ScreenLayout, VerificationWall } from "../../components/ui";
import { uploadFile } from "../../api/files";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import type { NeighborAdCategory } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"NeighborAdNew">;

const MAX_PHOTOS = 5;

const categories: NeighborAdCategory[] = [
    "sell", "buy", "lost", "found", "service", "invite", "other",
];

const labels: Record<NeighborAdCategory, string> = {
    sell: "Продаю",
    buy: "Ищу",
    lost: "Потеряно",
    found: "Найдено",
    service: "Услуга",
    invite: "Приглашаю",
    other: "Другое",
};

type PhotoItem =
    | { kind: "existing"; uri: string }
    | { kind: "new"; uri: string };

export function NeighborAdNewScreen({ navigation, route }: Props) {
    const { addNeighborAd, editNeighborAd, neighborAds, profile, verification } = useApp();

    if (!isVerifiedResident(verification)) {
        return (
            <ScreenLayout title="Объявление" onBack={() => navigation.goBack()}>
                <VerificationWall message="Публиковать объявления могут только верифицированные жильцы дома." />
            </ScreenLayout>
        );
    }
    const editId = route?.params?.editId;
    const existing = editId ? neighborAds.find((a) => a.id === editId) : undefined;

    const [title, setTitle] = useState(existing?.title ?? "");
    const [body, setBody] = useState(existing?.body ?? "");
    const preset = route.params?.presetCategory;
    const [category, setCategory] = useState<NeighborAdCategory>(existing?.category ?? "sell");
    const [phone, setPhone] = useState(existing?.authorPhone ?? "");
    const [useProfilePhone, setUseProfilePhone] = useState(false);
    const [photos, setPhotos] = useState<PhotoItem[]>(
        () => (existing?.imageUrls ?? []).map((uri) => ({ kind: "existing" as const, uri })),
    );
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!existing && preset && categories.includes(preset)) {
            setCategory(preset);
        }
    }, [preset, existing]);

    useEffect(() => {
        if (useProfilePhone) {
            setPhone(profile.phone ?? "");
        }
    }, [useProfilePhone, profile.phone]);

    const pickPhoto = async () => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert("Максимум фото", `Можно добавить не более ${MAX_PHOTOS} фото`);
            return;
        }
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Нет доступа", "Разрешите доступ к галерее в настройках.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - photos.length,
            allowsEditing: false,
            quality: 0.8,
        });
        if (!result.canceled) {
            const newItems: PhotoItem[] = result.assets.map((a) => ({
                kind: "new" as const,
                uri: a.uri,
            }));
            setPhotos((prev) => [...prev, ...newItems].slice(0, MAX_PHOTOS));
        }
    };

    const removePhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    const submit = async () => {
        if (!title.trim() || !body.trim()) {
            setErr("Заполните заголовок и текст");
            return;
        }
        const trimmedPhone = phone.trim();
        const showPhone = trimmedPhone.length > 0;

        // Загружаем новые фото на сервер, существующие берём как есть
        let imageUrls: string[];
        try {
            imageUrls = await Promise.all(
                photos.map((p) => p.kind === "existing" ? Promise.resolve(p.uri) : uploadFile(p.uri)),
            );
        } catch {
            setErr("Не удалось загрузить фото");
            setSubmitting(false);
            return;
        }

        setSubmitting(true);
        const r = editId
            ? await editNeighborAd(editId, {
                title: title.trim(),
                body: body.trim(),
                category,
                imageUrls,
                showPhone,
                authorPhone: showPhone ? trimmedPhone : undefined,
              })
            : await addNeighborAd({
                title: title.trim(),
                body: body.trim(),
                category,
                imageUrls,
                showPhone,
                authorPhone: showPhone ? trimmedPhone : undefined,
              });
        setSubmitting(false);
        if (!r.ok) {
            setErr("reason" in r ? r.reason : "");
            return;
        }
        setErr("");
        navigation.goBack();
    };

    return (
        <ScreenLayout
            title="Объявление"
            subtitle="Видно только вашему дому · 30 дней"
            onBack={() => navigation.goBack()}
        >
            <Text style={[textStyles.label, styles.label]}>Категория</Text>
            <View style={styles.chips}>
                {categories.map((c) => (
                    <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        style={[styles.chip, category === c && styles.chipActive]}
                    >
                        <Text style={[textStyles.caption, category === c ? styles.chipTextActive : styles.chipText]}>
                            {labels[c]}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <Card style={styles.adCard}>
                <View style={styles.adHeader}>
                    <View style={styles.adBadge}>
                        <Text style={styles.adBadgeText}>{labels[category]}</Text>
                    </View>
                </View>
                <Input
                    label="Заголовок"
                    value={title}
                    onChangeText={setTitle}
                />
                <View style={styles.gap} />
                <Input
                    label="Текст"
                    value={body}
                    onChangeText={setBody}
                    multiline
                    style={styles.area}
                />
                <View style={styles.gap} />
                <Text style={[textStyles.label, styles.photoLabel]}>
                    Фото (необязательно, до {MAX_PHOTOS})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                    {photos.map((p, i) => (
                        <View key={i} style={styles.thumbWrap}>
                            <Image source={{ uri: p.uri }} style={styles.thumb} />
                            <Pressable onPress={() => removePhoto(i)} style={styles.removeBtn} hitSlop={6}>
                                <Text style={styles.removeBtnText}>×</Text>
                            </Pressable>
                        </View>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                        <Pressable onPress={() => { void pickPhoto(); }} style={styles.addBtn}>
                            <Text style={styles.addBtnText}>+</Text>
                        </Pressable>
                    )}
                </ScrollView>
                <View style={styles.gap} />
                <Input
                    label="Телефон для связи (необязательно)"
                    value={phone}
                    onChangeText={(v) => { if (!useProfilePhone) setPhone(v); }}
                    keyboardType="phone-pad"
                    placeholder="+7 900 000-00-00"
                    editable={!useProfilePhone}
                />
                <Pressable
                    style={styles.row}
                    onPress={() => setUseProfilePhone((v) => !v)}
                >
                    <View style={[styles.checkbox, useProfilePhone && styles.checkboxOn]} />
                    <Text style={[textStyles.caption, styles.rowText]}>
                        Использовать номер из профиля
                    </Text>
                </Pressable>
                {!!err && (
                    <Text style={[textStyles.caption, styles.err]}>{err}</Text>
                )}
                <View style={styles.gapLg} />
                <Button
                    title={submitting ? "Сохранение..." : editId ? "Сохранить" : "Опубликовать"}
                    onPress={() => { void submit(); }}
                    disabled={submitting}
                />
            </Card>
        </ScreenLayout>
    );
}

const THUMB_SIZE = 90;

const styles = StyleSheet.create({
    label: { color: colors.textMuted },
    adCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
    adHeader: { marginBottom: spacing.md },
    adBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "rgba(61, 158, 122, 0.12)",
    },
    adBadgeText: { fontSize: 11, fontWeight: "600", color: colors.primary },
    chips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    chipText: { color: colors.textMuted },
    chipTextActive: { color: colors.primary },
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    area: { minHeight: 100, textAlignVertical: "top" },
    err: { color: colors.danger, marginTop: spacing.sm },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginTop: spacing.md,
    },
    checkbox: {
        width: 20, height: 20, borderRadius: 5,
        borderWidth: 2, borderColor: colors.border,
    },
    checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    rowText: { color: colors.textMuted },
    photoLabel: { color: colors.textMuted, marginBottom: spacing.sm },
    photoRow: { flexDirection: "row", marginBottom: spacing.xs },
    thumbWrap: {
        width: THUMB_SIZE, height: THUMB_SIZE,
        marginRight: spacing.sm,
        position: "relative",
    },
    thumb: {
        width: THUMB_SIZE, height: THUMB_SIZE,
        borderRadius: radius.md,
        backgroundColor: colors.border,
    },
    removeBtn: {
        position: "absolute", top: -6, right: -6,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: colors.danger,
        alignItems: "center", justifyContent: "center",
    },
    removeBtnText: { color: colors.bg, fontSize: 16, lineHeight: 20, fontWeight: "700" },
    addBtn: {
        width: THUMB_SIZE, height: THUMB_SIZE,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
        alignItems: "center", justifyContent: "center",
        backgroundColor: colors.surface,
    },
    addBtnText: { color: colors.primary, fontSize: 32, lineHeight: 36 },
});
