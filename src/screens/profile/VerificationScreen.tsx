import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { uploadFile } from "../../api/files";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";
import type { VerificationStatus } from "../../types";

type Props = ProfileScreenProps<"Verification">;

type DocType = "lease" | "ownership";

const statusConfig: Record<VerificationStatus, {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    hint: string;
}> = {
    none: {
        icon: "shield-outline",
        color: colors.textMuted,
        label: "Не верифицирован",
        hint: "Подтвердите право проживания, чтобы получить доступ ко всем функциям",
    },
    pending: {
        icon: "time-outline",
        color: colors.warning,
        label: "На рассмотрении",
        hint: "Ваша заявка принята и ожидает проверки управляющей компанией",
    },
    approved: {
        icon: "shield-checkmark",
        color: colors.primary,
        label: "Верифицирован",
        hint: "Статус подтверждён — вам доступны все функции приложения",
    },
    rejected: {
        icon: "shield-outline",
        color: colors.danger,
        label: "Отклонён",
        hint: "Заявка отклонена. Проверьте комментарий и отправьте повторно",
    },
};

const docTypes: { key: DocType; icon: keyof typeof Ionicons.glyphMap; title: string; hint: string }[] = [
    {
        key: "lease",
        icon: "document-text-outline",
        title: "Договор аренды",
        hint: "Актуальный договор найма жилого помещения",
    },
    {
        key: "ownership",
        icon: "home-outline",
        title: "Право собственности",
        hint: "Выписка ЕГРН, свидетельство и т.п.",
    },
];

export function VerificationScreen({ navigation }: Props) {
    const { verification, submitVerification } = useApp();
    const [docType, setDocType] = useState<DocType>("lease");
    const [pdConsent, setPdConsent] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = verification.status === "none" || verification.status === "rejected";
    const cfg = statusConfig[verification.status];

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
            Alert.alert("Отправлено", "Заявка принята. Ожидайте решения УК.");
        }
    };

    return (
        <ScreenLayout
            title="Верификация"
            subtitle="Подтверждение права на жильё"
            onBack={() => navigation.goBack()}
        >
            {/* ── Статус ── */}
            <Card style={styles.statusCard}>
                <View style={[styles.statusIconCircle, { backgroundColor: `${cfg.color}18`, borderColor: `${cfg.color}40` }]}>
                    <Ionicons name={cfg.icon} size={32} color={cfg.color} />
                </View>
                <View style={styles.statusText}>
                    <View style={styles.statusLabelRow}>
                        <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                        <Text style={[textStyles.title, styles.statusLabel, { color: cfg.color }]}>
                            {cfg.label}
                        </Text>
                    </View>
                    <Text style={[textStyles.caption, styles.statusHint]}>
                        {cfg.hint}
                    </Text>
                    {verification.submittedAt && (
                        <View style={styles.dateRow}>
                            <Ionicons name="calendar-outline" size={13} color={colors.textDim} />
                            <Text style={styles.dateText}>
                                {new Date(verification.submittedAt).toLocaleString("ru-RU", {
                                    day: "numeric", month: "long", year: "numeric",
                                })}
                            </Text>
                        </View>
                    )}
                </View>
            </Card>

            {/* ── Комментарий УК при отклонении ── */}
            {verification.status === "rejected" && verification.comment && (
                <Card style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                        <Ionicons name="chatbox-outline" size={16} color={colors.danger} />
                        <Text style={styles.commentTitle}>Комментарий УК</Text>
                    </View>
                    <Text style={[textStyles.body, styles.commentText]}>
                        {verification.comment}
                    </Text>
                </Card>
            )}

            {/* ── Форма отправки ── */}
            {canSubmit && (
                <>
                    {/* Согласие */}
                    <Pressable
                        onPress={() => setPdConsent((v) => !v)}
                        style={({ pressed }) => [
                            styles.consentCard,
                            pdConsent && styles.consentCardOn,
                            pressed && styles.consentPressed,
                        ]}
                    >
                        <View style={[styles.checkbox, pdConsent && styles.checkboxOn]}>
                            {pdConsent && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                        </View>
                        <Text style={[textStyles.caption, styles.consentText]}>
                            Согласен на обработку персональных данных для прохождения верификации.{"  "}
                            <Text
                                style={styles.policyLink}
                                onPress={() => navigation.navigate("PrivacyPolicy")}
                            >
                                Политика конфиденциальности
                            </Text>
                        </Text>
                    </Pressable>

                    {/* Тип документа */}
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconWrap}>
                            <Ionicons name="document-outline" size={13} color={colors.accent} />
                        </View>
                        <Text style={[styles.sectionLabel, { color: colors.accent }]}>Тип документа</Text>
                        <View style={styles.sectionLine} />
                    </View>

                    <View style={styles.docTypes}>
                        {docTypes.map((dt) => {
                            const active = docType === dt.key;
                            return (
                                <Pressable
                                    key={dt.key}
                                    onPress={() => setDocType(dt.key)}
                                    style={({ pressed }) => [
                                        styles.docCard,
                                        active && styles.docCardOn,
                                        pressed && !active && styles.docCardPressed,
                                    ]}
                                >
                                    <View style={[styles.docIconWrap, active && styles.docIconWrapOn]}>
                                        <Ionicons
                                            name={dt.icon}
                                            size={22}
                                            color={active ? colors.primary : colors.textMuted}
                                        />
                                    </View>
                                    <Text style={[textStyles.subtitle, styles.docTitle, active && styles.docTitleOn]}>
                                        {dt.title}
                                    </Text>
                                    <Text style={[textStyles.caption, styles.docHint]}>
                                        {dt.hint}
                                    </Text>
                                    {active && (
                                        <View style={styles.docCheck}>
                                            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                                        </View>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    {docType === "lease" && (
                        <View style={styles.leaseHint}>
                            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                            <Text style={styles.leaseHintText}>
                                Арендаторы не участвуют в голосованиях — право голоса на ОСС принадлежит только собственникам (ЖК РФ ст. 48).
                            </Text>
                        </View>
                    )}

                    {/* Фото документа */}
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionIconWrap, { backgroundColor: colors.primarySoft }]}>
                            <Ionicons name="camera-outline" size={13} color={colors.primary} />
                        </View>
                        <Text style={[styles.sectionLabel, { color: colors.primary }]}>Фото документа</Text>
                        <View style={styles.sectionLine} />
                    </View>

                    <Card>
                        {photoUri ? (
                            <View style={styles.photoWrap}>
                                <Image
                                    source={{ uri: photoUri }}
                                    style={styles.photoPreview}
                                    resizeMode="cover"
                                />
                                <Pressable
                                    onPress={() => setPhotoUri(null)}
                                    style={styles.photoRemoveBtn}
                                >
                                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                                    <Text style={styles.photoRemoveText}>Удалить и выбрать другое</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => { void pickPhoto(); }}
                                style={({ pressed }) => [styles.uploadArea, pressed && styles.uploadAreaPressed]}
                            >
                                <View style={styles.uploadIconCircle}>
                                    <Ionicons name="cloud-upload-outline" size={28} color={colors.info} />
                                </View>
                                <Text style={styles.uploadTitle}>Прикрепить фото</Text>
                                <Text style={styles.uploadHint}>
                                    JPEG или PNG · Качество на камеру достаточно
                                </Text>
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
    /* Статус */
    statusCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
    },
    statusIconCircle: {
        width: 68,
        height: 68,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    statusText: { flex: 1, gap: spacing.xs },
    statusLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusLabel: { fontSize: 17 },
    statusHint: { color: colors.textMuted, lineHeight: 18 },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: spacing.xs,
    },
    dateText: { fontSize: 12, color: colors.textDim },

    /* Комментарий */
    commentCard: {
        borderLeftWidth: 3,
        borderLeftColor: colors.danger,
        gap: spacing.sm,
    },
    commentHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    commentTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.danger,
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },
    commentText: { color: colors.textMuted },

    /* Согласие */
    consentCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: "rgba(26, 35, 46, 0.6)",
        borderWidth: 1,
        borderColor: colors.border,
    },
    consentCardOn: {
        borderColor: `${colors.primary}66`,
        backgroundColor: colors.primarySoft,
    },
    consentPressed: { opacity: 0.85 },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
    },
    checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    consentText: { flex: 1, color: colors.textMuted, lineHeight: 20 },
    policyLink: { color: colors.primary, fontWeight: "600" },

    /* Секция */
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
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
    sectionLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },

    /* Тип документа */
    docTypes: {
        flexDirection: "row",
        gap: spacing.md,
    },
    docCard: {
        flex: 1,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        gap: spacing.sm,
        position: "relative",
    },
    docCardOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    docCardPressed: { opacity: 0.8 },
    docIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: "rgba(154, 165, 181, 0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    docIconWrapOn: { backgroundColor: "rgba(61, 158, 122, 0.2)" },
    docTitle: { color: colors.text, fontSize: 14 },
    docTitleOn: { color: colors.primary },
    docHint: { color: colors.textDim, lineHeight: 16 },
    docCheck: {
        position: "absolute",
        top: spacing.sm,
        right: spacing.sm,
    },

    /* Фото */
    photoWrap: { gap: spacing.md },
    photoPreview: {
        width: "100%",
        height: 200,
        borderRadius: radius.md,
        backgroundColor: colors.border,
    },
    photoRemoveBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        alignSelf: "flex-start",
    },
    photoRemoveText: { color: colors.danger, fontSize: 13 },
    uploadArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
        borderRadius: radius.lg,
        paddingVertical: spacing.xl + 4,
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: "rgba(91, 159, 212, 0.04)",
    },
    uploadAreaPressed: { opacity: 0.75 },
    uploadIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(91, 159, 212, 0.12)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.xs,
    },
    uploadTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.info,
    },
    uploadHint: {
        fontSize: 12,
        color: colors.textDim,
    },

    gap: { height: spacing.md },

    leaseHint: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.warning}44`,
        backgroundColor: `${colors.warning}0d`,
    },
    leaseHintText: {
        flex: 1,
        fontSize: 13,
        color: colors.warning,
        lineHeight: 18,
    },
});
