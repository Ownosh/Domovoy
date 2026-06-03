import type { CommunityScreenProps } from "../../navigation/types";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { NeighborAdCategory } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"NeighborAdNew">;

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

export function NeighborAdNewScreen({ navigation, route }: Props) {
    const { addNeighborAd, editNeighborAd, neighborAds, profile } = useApp();
    const editId = route?.params?.editId;
    const existing = editId ? neighborAds.find((a) => a.id === editId) : undefined;

    const [title, setTitle] = useState(existing?.title ?? "");
    const [body, setBody] = useState(existing?.body ?? "");
    const preset = route.params?.presetCategory;
    const [category, setCategory] = useState<NeighborAdCategory>(existing?.category ?? "sell");
    const [phone, setPhone] = useState(existing?.authorPhone ?? "");
    const [useProfilePhone, setUseProfilePhone] = useState(false);
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

    const submit = async () => {
        if (!title.trim() || !body.trim()) {
            setErr("Заполните заголовок и текст");
            return;
        }
        const trimmedPhone = phone.trim();
        const showPhone = trimmedPhone.length > 0;
        setSubmitting(true);
        const r = editId
            ? await editNeighborAd(editId, {
                title: title.trim(),
                body: body.trim(),
                category,
                showPhone,
                authorPhone: showPhone ? trimmedPhone : undefined,
              })
            : await addNeighborAd({
                title: title.trim(),
                body: body.trim(),
                category,
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
            <Card>
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

const styles = StyleSheet.create({
    label: { color: colors.textMuted },
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
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: colors.border,
    },
    checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    rowText: { color: colors.textMuted },
});
