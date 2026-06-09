import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"ChangePassword">;

type FieldErrors = {
    current?: string;
    next?: string;
    again?: string;
};

const rules = [
    "Не менее 6 символов",
    "Не используйте старый пароль",
];

export function ChangePasswordScreen({ navigation }: Props) {
    const { changePassword } = useApp();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [again, setAgain] = useState("");
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const clearError = (field: keyof FieldErrors) =>
        setFieldErrors((e) => ({ ...e, [field]: undefined }));

    const submit = async () => {
        const errors: FieldErrors = {};

        if (!current) {
            errors.current = "Введите текущий пароль";
        }

        if (!next) {
            errors.next = "Введите новый пароль";
        } else if (next.length < 6) {
            errors.next = "Не менее 6 символов";
        }

        if (!again) {
            errors.again = "Повторите новый пароль";
        } else if (next && next !== again) {
            errors.again = "Пароли не совпадают";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setLoading(true);
        const ok = await changePassword(current, next);
        setLoading(false);
        if (!ok) {
            setFieldErrors({ current: "Текущий пароль неверен" });
            return;
        }
        setDone(true);
        setTimeout(() => navigation.goBack(), 1200);
    };

    return (
        <ScreenLayout
            title="Смена пароля"
            subtitle="Обновление пароля для входа"
            onBack={() => navigation.goBack()}
        >
            {/* ── Инфо-баннер ── */}
            <Card style={styles.infoBanner}>
                <View style={styles.infoIconWrap}>
                    <Ionicons name="lock-closed" size={22} color={colors.accent} />
                </View>
                <View style={styles.infoText}>
                    <Text style={[textStyles.subtitle, styles.infoTitle]}>
                        Безопасность аккаунта
                    </Text>
                    <Text style={[textStyles.caption, styles.infoBody]}>
                        После смены пароля все активные сессии будут завершены.
                    </Text>
                </View>
            </Card>

            {/* ── Форма ── */}
            <Card>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconWrap}>
                        <Ionicons name="key-outline" size={14} color={colors.accent} />
                    </View>
                    <Text style={[styles.sectionLabel, { color: colors.accent }]}>Текущий пароль</Text>
                    <View style={styles.sectionLine} />
                </View>

                <Input
                    label="Введите текущий пароль"
                    value={current}
                    onChangeText={(v) => { setCurrent(v); clearError("current"); }}
                    secureTextEntry
                    showPasswordToggle
                    error={fieldErrors.current}
                />

                <View style={styles.divider} />

                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: colors.primarySoft }]}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionLabel, { color: colors.primary }]}>Новый пароль</Text>
                    <View style={styles.sectionLine} />
                </View>

                <Input
                    label="Новый пароль"
                    value={next}
                    onChangeText={(v) => { setNext(v); clearError("next"); }}
                    secureTextEntry
                    showPasswordToggle
                    error={fieldErrors.next}
                />
                <View style={styles.gap} />
                <Input
                    label="Повтор нового пароля"
                    value={again}
                    onChangeText={(v) => { setAgain(v); clearError("again"); }}
                    secureTextEntry
                    showPasswordToggle
                    error={fieldErrors.again}
                />

                {/* Требования к паролю */}
                <View style={styles.rulesWrap}>
                    {rules.map((r) => (
                        <View key={r} style={styles.ruleRow}>
                            <Ionicons name="ellipse" size={5} color={colors.textDim} />
                            <Text style={styles.ruleText}>{r}</Text>
                        </View>
                    ))}
                </View>
            </Card>

            {/* ── Кнопка / Успех ── */}
            {done ? (
                <View style={styles.successRow}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark" size={18} color={colors.bg} />
                    </View>
                    <Text style={[textStyles.subtitle, styles.successText]}>
                        Пароль успешно изменён
                    </Text>
                </View>
            ) : (
                <Button
                    title={loading ? "Сохранение..." : "Обновить пароль"}
                    onPress={() => { void submit(); }}
                    loading={loading}
                />
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    /* Инфо-баннер */
    infoBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    infoIconWrap: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: colors.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    infoText: { flex: 1, gap: 3 },
    infoTitle: { color: colors.text },
    infoBody: { color: colors.textMuted, lineHeight: 18 },

    /* Секция */
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: colors.accentSoft,
        alignItems: "center",
        justifyContent: "center",
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.borderSubtle,
    },
    divider: {
        height: 1,
        backgroundColor: colors.borderSubtle,
        marginVertical: spacing.lg,
    },

    /* Требования */
    rulesWrap: {
        marginTop: spacing.md,
        gap: spacing.xs,
        paddingLeft: spacing.sm,
    },
    ruleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    ruleText: {
        fontSize: 12,
        color: colors.textDim,
    },

    /* Успех */
    successRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: `${colors.primary}44`,
    },
    successIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    successText: { color: colors.primary },

    gap: { height: spacing.md },
});
