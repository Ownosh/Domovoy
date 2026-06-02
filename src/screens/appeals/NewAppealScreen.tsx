import type { AppealsScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { appealCategories } from "../../data/mockData";
import { useApp } from "../../context/AppContext";
import type { AppealKind } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = AppealsScreenProps<"AppealNew">;

export function NewAppealScreen({ navigation, route }: Props) {
    const { addAppeal, editAppeal, appeals, profile } = useApp();
    const editId = route.params?.editId;
    const existing = editId ? appeals.find((a) => a.id === editId) : undefined;
    const [title, setTitle] = useState(existing?.title ?? "");
    const [body, setBody] = useState(existing?.body ?? "");
    const [category, setCategory] = useState(existing?.category ?? appealCategories[0]);
    const [kind, setKind] = useState<AppealKind>(existing?.kind ?? route.params?.defaultKind ?? "personal");
    const [entrance, setEntrance] = useState(
        existing?.entrance ?? (profile.entrance != null ? String(profile.entrance) : ""),
    );
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (!title.trim() || !body.trim()) {
            setErr("Укажите тему и описание");
            return;
        }
        if (kind === "collective" && !entrance.trim()) {
            setErr("Для коллективного обращения укажите номер подъезда (для порога квартир)");
            return;
        }
        setErr("");
        setSubmitting(true);
        const r = editId
            ? await editAppeal(editId, {
                title: title.trim(), body: body.trim(), category,
                entrance: kind === "collective" ? entrance.trim() : undefined,
              })
            : await addAppeal({
                title: title.trim(), body: body.trim(), category, kind,
                entrance: kind === "collective" ? entrance.trim() : undefined,
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
            <Text style={[textStyles.label, styles.label]}>Тип обращения</Text>
            <View style={styles.kindRow}>
                <Pressable
                    onPress={() => setKind("personal")}
                    style={[
                        styles.kindChip,
                        kind === "personal" && styles.kindChipOn,
                    ]}
                >
                    <Text
                        style={[
                            textStyles.caption,
                            kind === "personal"
                                ? styles.kindChipTextOn
                                : styles.kindChipText,
                        ]}
                    >
                        Личное
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setKind("collective")}
                    style={[
                        styles.kindChip,
                        kind === "collective" && styles.kindChipOn,
                    ]}
                >
                    <Text
                        style={[
                            textStyles.caption,
                            kind === "collective"
                                ? styles.kindChipTextOn
                                : styles.kindChipText,
                        ]}
                    >
                        Коллективное
                    </Text>
                </Pressable>
            </View>
            <Text style={[textStyles.caption, styles.hint]}>
                Коллективное попадает в общую ленту дома; соседи могут присоединиться
                после верификации.
            </Text>
            {kind === "collective" && (
                <Card style={styles.entCard}>
                    <Input
                        label="Подъезд №"
                        value={entrance}
                        onChangeText={setEntrance}
                        keyboardType="number-pad"
                        placeholder="Например: 2"
                        hint="Порог «массового обращения» — уникальные квартиры в этом подъезде"
                    />
                </Card>
            )}
            <Text style={[textStyles.label, styles.label]}>Категория</Text>
            <View style={styles.chips}>
                {appealCategories.map((c) => (
                    <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        style={[
                            styles.chip,
                            category === c && styles.chipActive,
                        ]}
                    >
                        <Text
                            style={[
                                textStyles.caption,
                                category === c
                                    ? styles.chipTextActive
                                    : styles.chipText,
                            ]}
                            numberOfLines={1}
                        >
                            {c}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <Card>
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
                {!!err && (
                    <Text style={[textStyles.caption, styles.err]}>{err}</Text>
                )}
                <View style={styles.gapLg} />
                <Button title={submitting ? "Сохранение..." : editId ? "Сохранить" : "Отправить"} onPress={submit} disabled={submitting} />
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    label: { color: colors.textMuted },
    kindRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    kindChip: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    kindChipOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    kindChipText: { color: colors.textMuted },
    kindChipTextOn: { color: colors.primary, fontWeight: "600" },
    hint: { color: colors.textDim, marginBottom: spacing.md, lineHeight: 18 },
    entCard: { marginBottom: spacing.md },
    chips: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        maxWidth: "100%",
    },
    chipActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    chipText: { color: colors.textMuted },
    chipTextActive: { color: colors.primary },
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    area: { minHeight: 120, textAlignVertical: "top" },
    err: { color: colors.danger, marginTop: spacing.sm },
});
