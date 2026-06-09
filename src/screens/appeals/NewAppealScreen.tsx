import type { AppealsScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, CollapsibleHint, Input, ScreenLayout, VerificationWall } from "../../components/ui";
import { uploadFile } from "../../api/files";
import { appealCategories } from "../../data/mockData";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import type { AppealKind } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = AppealsScreenProps<"AppealNew">;

const MAX_PHOTOS = 5;

type PhotoItem =
    | { kind: "existing"; uri: string }
    | { kind: "new"; uri: string };

export function NewAppealScreen({ navigation, route }: Props) {
    const { addAppeal, editAppeal, appeals, profile, verification } = useApp();

    if (!isVerifiedResident(verification) && !route.params?.editId) {
        return (
            <ScreenLayout title="Новое обращение" onBack={() => navigation.goBack()}>
                <VerificationWall message="Подавать обращения могут только верифицированные жильцы дома." />
            </ScreenLayout>
        );
    }
    const editId = route.params?.editId;
    const existing = editId ? appeals.find((a) => a.id === editId) : undefined;
    const [title, setTitle] = useState(existing?.title ?? "");
    const [body, setBody] = useState(existing?.body ?? "");
    const [category, setCategory] = useState(existing?.category ?? appealCategories[0]);
    const [kind, setKind] = useState<AppealKind>(existing?.kind ?? route.params?.defaultKind ?? "personal");
    const [entrance, setEntrance] = useState(
        existing?.entrance ?? (profile.entrance != null ? String(profile.entrance) : ""),
    );
    const [photos, setPhotos] = useState<PhotoItem[]>(
        () => (existing?.imageUrls ?? []).map((uri) => ({ kind: "existing" as const, uri })),
    );
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);

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
            setErr("Укажите тему и описание");
            return;
        }
        if (kind === "collective" && !entrance.trim()) {
            setErr("Для коллективного обращения укажите номер подъезда");
            return;
        }
        setErr("");
        setSubmitting(true);

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

        const r = editId
            ? await editAppeal(editId, {
                title: title.trim(), body: body.trim(), category,
                entrance: kind === "collective" ? entrance.trim() : undefined,
                imageUrls,
              })
            : await addAppeal({
                title: title.trim(), body: body.trim(), category, kind,
                entrance: kind === "collective" ? entrance.trim() : undefined,
                imageUrls,
              });
        setSubmitting(false);
        if (!r.ok) {
            setErr("reason" in r ? r.reason : "Ошибка отправки");
            return;
        }
        navigation.popToTop();
    };

    return (
        <ScreenLayout
            title={editId ? "Редактирование" : "Новое обращение"}
            subtitle="Опишите проблему"
            onBack={() => navigation.goBack()}
        >
                <Card style={kind === "collective" ? styles.cardCollective : styles.cardPersonal}>
                    <Text style={[textStyles.label, styles.sectionLabel]}>Тип обращения</Text>
                    <View style={[styles.kindRow, styles.rowGap]}>
                        <Pressable
                            onPress={() => setKind("personal")}
                            style={[styles.kindChip, kind === "personal" && styles.kindChipOn]}
                        >
                            <Text style={[textStyles.caption, kind === "personal" ? styles.kindChipTextOn : styles.kindChipText]}>
                                Личное
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setKind("collective")}
                            style={[styles.kindChip, kind === "collective" && styles.kindChipOn]}
                        >
                            <Text style={[textStyles.caption, kind === "collective" ? styles.kindChipTextOn : styles.kindChipText]}>
                                Коллективное
                            </Text>
                        </Pressable>
                    </View>
                    <Text style={[textStyles.label, styles.sectionLabel]}>Категория</Text>
                    <View style={[styles.chips, styles.rowGap]}>
                        {appealCategories.map((c) => (
                            <Pressable
                                key={c}
                                onPress={() => setCategory(c)}
                                style={[styles.chip, category === c && styles.chipActive]}
                            >
                                <Text style={[textStyles.caption, category === c ? styles.chipTextActive : styles.chipText]} numberOfLines={1}>
                                    {c}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    <View style={styles.divider} />
                    <Input
                        label="Тема"
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Кратко, по сути"
                    />
                    <View style={styles.gap} />
                    <Input
                        label="Описание"
                        value={body}
                        onChangeText={setBody}
                        placeholder="Подробности, адрес, удобное время"
                        multiline
                        style={styles.area}
                    />
                    {kind === "collective" && (
                        <>
                            <View style={styles.gap} />
                            <Input
                                label="Подъезд №"
                                value={entrance}
                                onChangeText={setEntrance}
                                keyboardType="number-pad"
                                placeholder="Например: 2"
                                hint="Порог «массового обращения» — уникальные квартиры в этом подъезде"
                            />
                        </>
                    )}
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
                    {!!err && (
                        <Text style={[textStyles.caption, styles.err]}>{err}</Text>
                    )}
                    <View style={styles.gapSm} />
                    <Button
                        title={submitting ? "Сохранение..." : editId ? "Сохранить" : "Отправить"}
                        variant={editId ? "primary" : "info"}
                        onPress={() => { void submit(); }}
                        disabled={submitting}
                        style={styles.submitBtn}
                    />
                </Card>
            <CollapsibleHint
                text={kind === "collective"
                    ? "Коллективное попадает в ленту дома — соседи смогут присоединиться. Опишите проблему подробно."
                    : "Опишите проблему подробно. Личное обращение видно только вам и УК."}
                defaultOpen={false}
            />
        </ScreenLayout>
    );
}

const THUMB_SIZE = 90;

const styles = StyleSheet.create({
    submitBtn: { alignSelf: "flex-end", borderRadius: 999, paddingHorizontal: 28 },
    sectionLabel: { color: colors.text, marginBottom: spacing.sm },
    rowGap: { marginBottom: spacing.md },
    divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing.md },
    cardPersonal: { borderLeftWidth: 3, borderLeftColor: colors.info },
    cardCollective: { borderLeftWidth: 3, borderLeftColor: colors.info },
    kindRow: { flexDirection: "row", gap: spacing.sm },
    kindChip: {
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        borderRadius: radius.full, borderWidth: 1,
        borderColor: colors.border, backgroundColor: colors.bgElevated,
    },
    kindChipOn: { borderColor: colors.info, backgroundColor: `${colors.info}15` },
    kindChipText: { color: colors.textMuted },
    kindChipTextOn: { color: colors.info, fontWeight: "600" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radius.full, backgroundColor: colors.bgElevated,
        borderWidth: 1, borderColor: colors.border, maxWidth: "100%",
    },
    chipActive: { borderColor: colors.info, backgroundColor: `${colors.info}15` },
    chipText: { color: colors.textMuted },
    chipTextActive: { color: colors.info },
    gap: { height: spacing.md },
    gapSm: { height: spacing.sm },
    gapLg: { height: spacing.lg },
    area: { minHeight: 120, textAlignVertical: "top" },
    err: { color: colors.danger, marginTop: spacing.sm },
    photoLabel: { color: colors.text },
    photoSub: { color: colors.textDim, marginTop: 2, marginBottom: spacing.sm },
    photoRow: { flexDirection: "row", marginBottom: spacing.xs },
    thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE, marginRight: spacing.sm, position: "relative" },
    thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: radius.md, backgroundColor: colors.border },
    removeBtn: {
        position: "absolute", top: -6, right: -6,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
    },
    removeBtnText: { color: "#fff", fontSize: 16, lineHeight: 20, fontWeight: "700" },
    addBtn: {
        width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
        alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
    },
    addBtnText: { color: colors.text, fontSize: 32, lineHeight: 36 },
});
