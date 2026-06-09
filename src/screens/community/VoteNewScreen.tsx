import type { CommunityScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, CollapsibleHint, Input, ScreenLayout, VerificationWall } from "../../components/ui";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import type { VoteVisibility } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"VoteNew">;

const DURATIONS: { days: 3 | 7 | 14; label: string }[] = [
    { days: 3, label: "3 дня" },
    { days: 7, label: "7 дней" },
    { days: 14, label: "14 дней" },
];

export function VoteNewScreen({ navigation, route }: Props) {
    const { addResidentVote, editVote, votes, verification } = useApp();

    if (!isVerifiedResident(verification) && !route?.params?.editId) {
        return (
            <ScreenLayout title="Новое голосование" onBack={() => navigation.goBack()}>
                <VerificationWall message="Создавать голосования могут только верифицированные жильцы дома." />
            </ScreenLayout>
        );
    }
    const editId = route?.params?.editId;
    const existing = editId ? votes.find((v) => v.id === editId) : undefined;
    const [topic, setTopic] = useState(existing?.topic ?? "");
    const [description, setDescription] = useState(existing?.description ?? "");
    const [visibility, setVisibility] = useState<VoteVisibility>((existing?.visibility as VoteVisibility) ?? "open");
    const [opt1, setOpt1] = useState(existing?.options[0]?.label ?? "");
    const [opt2, setOpt2] = useState(existing?.options[1]?.label ?? "");
    const [opt3, setOpt3] = useState(existing?.options[2]?.label ?? "");
    const [opt4, setOpt4] = useState(existing?.options[3]?.label ?? "");
    const [durationDays, setDurationDays] = useState<3 | 7 | 14>(7);
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        const labels = [opt1, opt2, opt3, opt4]
            .map((s) => s.trim())
            .filter(Boolean);
        setSubmitting(true);
        const r = editId
            ? await editVote(editId, { topic: topic.trim(), description: description.trim(), visibility, optionLabels: labels })
            : await addResidentVote({ topic: topic.trim(), description: description.trim(), visibility, optionLabels: labels, durationDays });
        setSubmitting(false);
        if (!r.ok) {
            setErr("reason" in r ? r.reason : "");
            return;
        }
        setErr("");
        Alert.alert(
            "Голосование создано",
            "Оно появится в ленте дома. Напоминаем: для юридически значимого ОСС используется официальная процедура и ГИС ЖКХ.",
            [{ text: "OK", onPress: () => navigation.goBack() }],
        );
    };

    return (
        <ScreenLayout
            title="Новое голосование"
            subtitle="Инициатива жильца · видно вашему дому"
            onBack={() => navigation.goBack()}
        >
            <Card style={styles.voteCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.voteBadge}>
                        <Text style={styles.voteBadgeText}>Голосование</Text>
                    </View>
                </View>
                <Input label="Тема голосования" value={topic} onChangeText={setTopic} />
                <View style={styles.gap} />
                <Input
                    label="Описание / контекст"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    style={styles.area}
                />
                <Text style={[textStyles.label, styles.label]}>Формат</Text>
                <View style={styles.row}>
                    <Pressable
                        onPress={() => setVisibility("open")}
                        style={[
                            styles.chip,
                            visibility === "open" && styles.chipOn,
                        ]}
                    >
                        <Text
                            style={[
                                textStyles.caption,
                                visibility === "open"
                                    ? styles.chipTextOn
                                    : styles.chipText,
                            ]}
                        >
                            Открытое
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setVisibility("secret")}
                        style={[
                            styles.chip,
                            visibility === "secret" && styles.chipOn,
                        ]}
                    >
                        <Text
                            style={[
                                textStyles.caption,
                                visibility === "secret"
                                    ? styles.chipTextOn
                                    : styles.chipText,
                            ]}
                        >
                            Тайное
                        </Text>
                    </Pressable>
                </View>
                <Text style={[textStyles.label, styles.label]}>Срок</Text>
                <View style={styles.row}>
                    {DURATIONS.map((d) => (
                        <Pressable
                            key={d.days}
                            onPress={() => setDurationDays(d.days)}
                            style={[
                                styles.chip,
                                durationDays === d.days && styles.chipOn,
                            ]}
                        >
                            <Text
                                style={[
                                    textStyles.caption,
                                    durationDays === d.days
                                        ? styles.chipTextOn
                                        : styles.chipText,
                                ]}
                            >
                                {d.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={[textStyles.label, styles.label]}>Варианты ответа</Text>
                <Input
                    label="Вариант 1"
                    labelStyle={styles.variantLabel}
                    value={opt1}
                    onChangeText={setOpt1}
                    placeholder="Обязательно"
                />
                <View style={styles.gapSm} />
                <Input
                    label="Вариант 2"
                    labelStyle={styles.variantLabel}
                    value={opt2}
                    onChangeText={setOpt2}
                    placeholder="Обязательно"
                />
                <View style={styles.gapSm} />
                <Input
                    label="Вариант 3"
                    labelStyle={styles.variantLabel}
                    value={opt3}
                    onChangeText={setOpt3}
                    placeholder="Необязательно"
                />
                <View style={styles.gapSm} />
                <Input
                    label="Вариант 4"
                    labelStyle={styles.variantLabel}
                    value={opt4}
                    onChangeText={setOpt4}
                    placeholder="Необязательно"
                />
                {!!err && (
                    <Text style={[textStyles.caption, styles.err]}>{err}</Text>
                )}
                <View style={styles.gapSm} />
                <Button
                    title={submitting ? "Сохранение..." : editId ? "Сохранить" : "Опубликовать"}
                    variant="info"
                    onPress={() => { void submit(); }}
                    disabled={submitting}
                    style={styles.submitBtn}
                />
            </Card>
            <CollapsibleHint text="Укажите тему, пояснение и варианты ответа (от 2 до 4). Создавать опрос могут жильцы с подтверждённой верификацией; вес по площади берётся из профиля. Это не заменяет официальное ОСС." defaultOpen={false} />
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    submitBtn: { alignSelf: "flex-end", borderRadius: 999, paddingHorizontal: 28 },
    variantLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 0.6 },
    voteCard: { borderLeftWidth: 3, borderLeftColor: colors.info },
    cardHeader: { marginBottom: spacing.md },
    voteBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: `${colors.info}18`,
    },
    voteBadgeText: { fontSize: 11, fontWeight: "600", color: colors.info },
    label: { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
    row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    chipOn: {
        borderColor: colors.info,
        backgroundColor: `${colors.info}15`,
    },
    chipText: { color: colors.textMuted },
    chipTextOn: { color: colors.info },
    gap: { height: spacing.md },
    gapSm: { height: spacing.sm },
    gapLg: { height: spacing.lg },
    area: { minHeight: 100, textAlignVertical: "top" },
    err: { color: colors.danger, marginTop: spacing.md },
});
