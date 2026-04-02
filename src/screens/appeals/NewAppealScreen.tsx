import type { AppealsScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { appealCategories } from "../../data/mockData";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = AppealsScreenProps<"AppealNew">;

export function NewAppealScreen({ navigation }: Props) {
    const { addAppeal } = useApp();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [category, setCategory] = useState(appealCategories[0]);
    const [err, setErr] = useState("");

    const submit = () => {
        if (!title.trim() || !body.trim()) {
            setErr("Укажите тему и описание");
            return;
        }
        setErr("");
        addAppeal(title.trim(), body.trim(), category);
        navigation.popToTop();
    };

    return (
        <ScreenLayout
            title="Новое обращение"
            subtitle="Опишите проблему"
            onBack={() => navigation.goBack()}
        >
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
