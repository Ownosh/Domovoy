import type { AppealsScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { appealCategories } from "../../data/mockData";
import { useApp } from "../../context/AppContext";
import type { AppealKind } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = AppealsScreenProps<"AppealNew">;

export function NewAppealScreen({ navigation }: Props) {
    const { addAppeal } = useApp();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [category, setCategory] = useState(appealCategories[0]);
    const [kind, setKind] = useState<AppealKind>("personal");
    const [entrance, setEntrance] = useState("");
    const [err, setErr] = useState("");

    const submit = () => {
        if (!title.trim() || !body.trim()) {
            setErr("Укажите тему и описание");
            return;
        }
        if (kind === "collective" && !entrance.trim()) {
            setErr("Для коллективного обращения укажите номер подъезда (для порога квартир)");
            return;
        }
        setErr("");
        addAppeal({
            title: title.trim(),
            body: body.trim(),
            category,
            kind,
            entrance: kind === "collective" ? entrance.trim() : undefined,
        });
        navigation.popToTop();
    };

    return (
        <ScreenLayout
            title="Новое обращение"
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
                <Button title="Отправить" onPress={submit} />
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
