import type { CommunityScreenProps } from "../../navigation/types";
import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, CollapsibleHint, Input, ScreenLayout, VerificationWall } from "../../components/ui";
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

    const handleToggleProfilePhone = () => {
        if (useProfilePhone) {
            setUseProfilePhone(false);
            setPhone("");
        } else {
            setUseProfilePhone(true);
            setPhone(profile.phone ?? "");
        }
    };

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
            <Card style={styles.adCard}>
                <CollapsibleHint text="Укажите заголовок, текст и категорию объявления. Оно будет видно только верифицированным жильцам вашего дома в течение 30 дней." />

                <Text style={[textStyles.label, styles.sectionLabel]}>Категория</Text>
                <View style={[styles.chips, styles.rowGap]}>
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

                <View style={styles.divider} />

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
                <Text style={[textStyles.label, styles.photoLabel]}>Фото</Text>
                <Text style={[textStyles.caption, styles.photoSub]}>необязательно, до {MAX_PHOTOS} фотографий</Text>
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
                {!useProfilePhone && (
                    <Input
                        label="Телефон для связи (необязательно)"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        placeholder="+7 900 000-00-00"
                    />
                )}
                <Pressable style={styles.checkRow} onPress={handleToggleProfilePhone}>
                    <View style={[styles.checkbox, useProfilePhone && styles.checkboxOn]}>
                        {useProfilePhone && (
                            <Ionicons name="checkmark" size={13} color="#fff" />
                        )}
                    </View>
                    <Text style={[textStyles.caption, styles.checkLabel]}>
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
                    style={styles.submitBtn}
                />
            </Card>
        </ScreenLayout>
    );
}

const THUMB_SIZE = 90;

const styles = StyleSheet.create({
    submitBtn: { alignSelf: "flex-end", borderRadius: 999, paddingHorizontal: 28 },
    adCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
    sectionLabel: { color: colors.text, marginBottom: spacing.sm },
    rowGap: { marginBottom: spacing.md },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.md },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: colors.bgElevated,
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
    checkRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginTop: spacing.md,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    checkLabel: { color: colors.textMuted },
    photoLabel: { color: colors.text },
    photoSub: { color: colors.textDim, marginTop: 2, marginBottom: spacing.sm },
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
    removeBtnText: { color: "#fff", fontSize: 16, lineHeight: 20, fontWeight: "700" },
    addBtn: {
        width: THUMB_SIZE, height: THUMB_SIZE,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
        alignItems: "center", justifyContent: "center",
        backgroundColor: colors.surface,
    },
    addBtnText: { color: colors.text, fontSize: 32, lineHeight: 36 },
});
