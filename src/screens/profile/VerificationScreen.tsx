import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { VerificationStatusBadge } from "../../components/ui/StatusBadge";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"Verification">;

export function VerificationScreen({ navigation }: Props) {
    const { verification, submitVerification, setVerificationDemo } = useApp();
    const [docType, setDocType] = useState<"lease" | "ownership">("lease");
    const [pdConsent, setPdConsent] = useState(false);

    const canSubmit =
        verification.status === "none" || verification.status === "rejected";

    const onUploadDemo = () => {
        if (!pdConsent) {
            Alert.alert(
                "Согласие нужно",
                "Отметьте согласие на обработку персональных данных для отправки документов на верификацию.",
            );
            return;
        }
        submitVerification(docType);
    };

    const onDemoStatus = (
        status: "pending" | "approved" | "rejected",
    ) => {
        if (!pdConsent) {
            Alert.alert(
                "Согласие нужно",
                "Отметьте согласие на обработку персональных данных перед сменой демо-статуса верификации.",
            );
            return;
        }
        setVerificationDemo(status);
    };

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

            <View style={styles.consentRow}>
                <Pressable
                    onPress={() => setPdConsent((v) => !v)}
                    style={styles.checkboxHit}
                >
                    <View
                        style={[
                            styles.checkbox,
                            pdConsent && styles.checkboxOn,
                        ]}
                    />
                </Pressable>
                <Text style={[textStyles.caption, styles.consentText]}>
                    Согласие на обработку персональных данных, необходимых для
                    верификации (в т.ч. сведений об адресе и документе).{" "}
                    <Text
                        style={styles.policyLink}
                        onPress={() => navigation.navigate("PrivacyPolicy")}
                    >
                        Политика конфиденциальности
                    </Text>
                </Text>
            </View>

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
                            onPress={onUploadDemo}
                            disabled={!pdConsent}
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
                        onPress={() => onDemoStatus("pending")}
                        disabled={!pdConsent}
                    />
                    <Button
                        variant="secondary"
                        title="Подтверждён"
                        onPress={() => onDemoStatus("approved")}
                        disabled={!pdConsent}
                    />
                    <Button
                        variant="secondary"
                        title="Отклонён"
                        onPress={() => onDemoStatus("rejected")}
                        disabled={!pdConsent}
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
    consentRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    checkboxHit: { paddingTop: 2 },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.border,
    },
    checkboxOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    consentText: { flex: 1, color: colors.textMuted, lineHeight: 20 },
    policyLink: { color: colors.primary, fontWeight: "600" },
});
