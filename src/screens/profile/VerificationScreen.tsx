import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { VerificationStatusBadge } from "../../components/ui/StatusBadge";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"Verification">;

export function VerificationScreen({ navigation }: Props) {
    const { verification, submitVerification, setVerificationDemo } = useApp();
    const [docType, setDocType] = useState<"lease" | "ownership">("lease");

    const canSubmit =
        verification.status === "none" || verification.status === "rejected";

    return (
        <ScreenLayout
            title="Верификация"
            subtitle="Подтверждение права проживания или собственности"
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Text style={[textStyles.caption, styles.statusLabel]}>
                    Статус
                </Text>
                <View style={styles.statusRow}>
                    <VerificationStatusBadge status={verification.status} />
                    {verification.status === "none" && (
                        <Text style={[textStyles.body, styles.none]}>
                            Документы не загружены
                        </Text>
                    )}
                </View>
                {verification.submittedAt && (
                    <Text style={[textStyles.caption, styles.date]}>
                        Отправлено:{" "}
                        {new Date(verification.submittedAt).toLocaleString(
                            "ru-RU",
                        )}
                    </Text>
                )}
                {verification.comment && (
                    <Text style={[textStyles.body, styles.comment]}>
                        {verification.comment}
                    </Text>
                )}
            </Card>

            {canSubmit && (
                <>
                    <Text style={[textStyles.label, styles.section]}>
                        Тип документа
                    </Text>
                    <View style={styles.types}>
                        <Pressable
                            onPress={() => setDocType("lease")}
                            style={[
                                styles.typeCard,
                                docType === "lease" && styles.typeCardOn,
                            ]}
                        >
                            <Text
                                style={[
                                    textStyles.subtitle,
                                    docType === "lease"
                                        ? styles.typeOn
                                        : styles.typeOff,
                                ]}
                            >
                                Договор аренды
                            </Text>
                            <Text style={[textStyles.caption, styles.typeHint]}>
                                Актуальный договор найма жилого помещения
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setDocType("ownership")}
                            style={[
                                styles.typeCard,
                                docType === "ownership" && styles.typeCardOn,
                            ]}
                        >
                            <Text
                                style={[
                                    textStyles.subtitle,
                                    docType === "ownership"
                                        ? styles.typeOn
                                        : styles.typeOff,
                                ]}
                            >
                                Право собственности
                            </Text>
                            <Text style={[textStyles.caption, styles.typeHint]}>
                                Выписка ЕГРН, свидетельство и т.п.
                            </Text>
                        </Pressable>
                    </View>
                    <Card>
                        <Text style={[textStyles.body, styles.uploadHint]}>
                            В демо-режиме загрузка файла имитируется кнопкой
                            ниже. После подключения бэкенда здесь будет выбор
                            файла и отправка на проверку УК.
                        </Text>
                        <View style={styles.gap} />
                        <Button
                            title="Загрузить документ (демо)"
                            onPress={() => submitVerification(docType)}
                        />
                    </Card>
                </>
            )}

            <Card style={styles.demo}>
                <Text style={[textStyles.label, styles.demoTitle]}>
                    Демо без сервера
                </Text>
                <Text style={[textStyles.caption, styles.demoText]}>
                    Имитация ответа управляющей компании для просмотра статусов
                    интерфейса.
                </Text>
                <View style={styles.demoBtns}>
                    <Button
                        variant="secondary"
                        title="На рассмотрении"
                        onPress={() => setVerificationDemo("pending")}
                    />
                    <Button
                        variant="secondary"
                        title="Подтверждён"
                        onPress={() => setVerificationDemo("approved")}
                    />
                    <Button
                        variant="secondary"
                        title="Отклонён"
                        onPress={() => setVerificationDemo("rejected")}
                    />
                </View>
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    statusLabel: { color: colors.textDim },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginTop: spacing.sm,
        flexWrap: "wrap",
    },
    none: { color: colors.textMuted },
    date: { color: colors.textDim, marginTop: spacing.md },
    comment: { color: colors.textMuted, marginTop: spacing.md },
    section: { color: colors.textMuted },
    types: { gap: spacing.md },
    typeCard: {
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    typeCardOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    typeOn: { color: colors.text },
    typeOff: { color: colors.text },
    typeHint: { color: colors.textMuted, marginTop: spacing.xs },
    uploadHint: { color: colors.textMuted },
    gap: { height: spacing.md },
    demo: { gap: spacing.md },
    demoTitle: { color: colors.textDim },
    demoText: { color: colors.textDim },
    demoBtns: { gap: spacing.sm },
});
