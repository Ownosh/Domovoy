import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { uploadFile } from "../../api/files";
import { VerificationStatusBadge } from "../../components/ui/StatusBadge";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"Verification">;

export function VerificationScreen({ navigation }: Props) {
    const { verification, submitVerification } = useApp();
    const [docType, setDocType] = useState<"lease" | "ownership">("lease");
    const [pdConsent, setPdConsent] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const canSubmit =
        verification.status === "none" || verification.status === "rejected";

    const pickPhoto = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Нет доступа", "Разрешите доступ к галерее в настройках.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const onSubmit = async () => {
        if (!pdConsent) {
            Alert.alert("Согласие нужно", "Отметьте согласие на обработку персональных данных.");
            return;
        }
        if (!photoUri) {
            Alert.alert("Фото нужно", "Прикрепите фото документа.");
            return;
        }
        setSubmitting(true);
        let photoUrl: string;
        try {
            photoUrl = await uploadFile(photoUri);
        } catch {
            setSubmitting(false);
            Alert.alert("Ошибка", "Не удалось загрузить фото. Проверьте соединение.");
            return;
        }
        const r = await submitVerification(docType, photoUrl);
        setSubmitting(false);
        if (!r.ok) {
            Alert.alert("Ошибка", "reason" in r ? r.reason : "Не удалось отправить заявку");
        } else {
            Alert.alert("Отправлено", "Заявка на верификацию принята. Ожидайте решения УК.");
        }
    };

    return (
        <ScreenLayout
            title="Верификация"
            subtitle="Подтверждение права проживания или собственности"
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Text style={[textStyles.caption, styles.statusLabel]}>Статус</Text>
                <View style={styles.statusRow}>
                    <VerificationStatusBadge status={verification.status} />
                    {verification.status === "none" && (
                        <Text style={[textStyles.body, styles.none]}>Документы не загружены</Text>
                    )}
                </View>
                {verification.submittedAt && (
                    <Text style={[textStyles.caption, styles.date]}>
                        Отправлено: {new Date(verification.submittedAt).toLocaleString("ru-RU")}
                    </Text>
                )}
                {verification.comment && (
                    <Text style={[textStyles.body, styles.comment]}>{verification.comment}</Text>
                )}
            </Card>

            {verification.status === "pending" && (
                <Card style={styles.pendingCard}>
                    <Text style={[textStyles.body, styles.pendingText]}>
                        Ваша заявка на рассмотрении у управляющей компании. Ожидайте ответа.
                    </Text>
                </Card>
            )}

            {verification.status === "approved" && (
                <Card style={styles.approvedCard}>
                    <Text style={[textStyles.body, styles.approvedText]}>
                        Верификация подтверждена. Вам доступны все функции приложения.
                    </Text>
                </Card>
            )}

            {canSubmit && (
                <>
                    <View style={styles.consentRow}>
                        <Pressable onPress={() => setPdConsent((v) => !v)} style={styles.checkboxHit}>
                            <View style={[styles.checkbox, pdConsent && styles.checkboxOn]} />
                        </Pressable>
                        <Text style={[textStyles.caption, styles.consentText]}>
                            Согласие на обработку персональных данных, необходимых для верификации.{" "}
                            <Text style={styles.policyLink} onPress={() => navigation.navigate("PrivacyPolicy")}>
                                Политика конфиденциальности
                            </Text>
                        </Text>
                    </View>

                    <Text style={[textStyles.label, styles.section]}>Тип документа</Text>
                    <View style={styles.types}>
                        <Pressable
                            onPress={() => setDocType("lease")}
                            style={[styles.typeCard, docType === "lease" && styles.typeCardOn]}
                        >
                            <Text style={[textStyles.subtitle, docType === "lease" ? styles.typeOn : styles.typeOff]}>
                                Договор аренды
                            </Text>
                            <Text style={[textStyles.caption, styles.typeHint]}>
                                Актуальный договор найма жилого помещения
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setDocType("ownership")}
                            style={[styles.typeCard, docType === "ownership" && styles.typeCardOn]}
                        >
                            <Text style={[textStyles.subtitle, docType === "ownership" ? styles.typeOn : styles.typeOff]}>
                                Право собственности
                            </Text>
                            <Text style={[textStyles.caption, styles.typeHint]}>
                                Выписка ЕГРН, свидетельство и т.п.
                            </Text>
                        </Pressable>
                    </View>

                    <Card>
                        <Text style={[textStyles.label, styles.photoLabel]}>Фото документа</Text>
                        {photoUri ? (
                            <View style={styles.photoWrap}>
                                <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                                <Pressable onPress={() => { setPhotoUri(null); }} style={styles.removePhoto}>
                                    <Text style={styles.removePhotoText}>Удалить фото</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable onPress={() => { void pickPhoto(); }} style={styles.pickBtn}>
                                <Text style={styles.pickBtnText}>+ Прикрепить фото документа</Text>
                            </Pressable>
                        )}
                        <View style={styles.gap} />
                        <Button
                            title={submitting ? "Отправка..." : "Отправить на верификацию"}
                            onPress={() => { void onSubmit(); }}
                            disabled={submitting || !pdConsent || !photoUri}
                            variant="info"
                        />
                    </Card>
                </>
            )}
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
    pendingCard: { borderLeftWidth: 3, borderLeftColor: colors.warning },
    pendingText: { color: colors.textMuted },
    approvedCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
    approvedText: { color: colors.textMuted },
    section: { color: colors.textMuted },
    types: { gap: spacing.md },
    typeCard: {
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    typeCardOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    typeOn: { color: colors.text },
    typeOff: { color: colors.text },
    typeHint: { color: colors.textMuted, marginTop: spacing.xs },
    gap: { height: spacing.md },
    consentRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    checkboxHit: { paddingTop: 2 },
    checkbox: {
        width: 22, height: 22, borderRadius: 6,
        borderWidth: 2, borderColor: colors.border,
    },
    checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    consentText: { flex: 1, color: colors.textMuted, lineHeight: 20 },
    policyLink: { color: colors.primary, fontWeight: "600" },
    photoLabel: { color: colors.textMuted, marginBottom: spacing.sm },
    pickBtn: {
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
        borderRadius: radius.md,
        paddingVertical: spacing.lg,
        alignItems: "center",
    },
    pickBtnText: { color: colors.info, fontSize: 14 },
    photoWrap: { gap: spacing.sm },
    photoPreview: {
        width: "100%",
        height: 200,
        borderRadius: radius.md,
        backgroundColor: colors.border,
    },
    removePhoto: { alignSelf: "flex-start" },
    removePhotoText: { color: colors.danger, fontSize: 13 },
});
