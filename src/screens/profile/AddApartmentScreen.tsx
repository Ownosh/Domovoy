import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Input, ScreenLayout, AddressAutocomplete } from "../../components/ui";
import type { BuildingSuggestion } from "../../api/buildings";
import { uploadFile } from "../../api/files";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"AddApartment">;

type DocType = "lease" | "ownership";

const MAX_PHOTOS = 5;

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

function SectionHeader({ icon, title, color = colors.primary }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    color?: string;
}) {
    return (
        <View style={sectionStyles.wrap}>
            <View style={[sectionStyles.iconWrap, { backgroundColor: `${color}1A` }]}>
                <Ionicons name={icon} size={13} color={color} />
            </View>
            <Text style={[sectionStyles.label, { color }]}>{title}</Text>
            <View style={sectionStyles.line} />
        </View>
    );
}

const sectionStyles = StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    iconWrap: {
        width: 22, height: 22, borderRadius: 6,
        alignItems: "center", justifyContent: "center",
    },
    label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
    line: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
});

export function AddApartmentScreen({ navigation }: Props) {
    const { addApartment } = useApp();

    const [building, setBuilding] = useState("");
    const [buildingKey, setBuildingKey] = useState("");
    const [apartment, setApartment] = useState("");
    const [entranceStr, setEntranceStr] = useState("");
    const [docType, setDocType] = useState<DocType>("lease");
    const [photos, setPhotos] = useState<string[]>([]);
    const [pdConsent, setPdConsent] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [errors, setErrors] = useState<{ building?: string; apartment?: string }>({});

    const onSelectBuilding = (item: BuildingSuggestion) => {
        setBuilding(item.short_name);
        setBuildingKey(item.building_key);
        setErrors((e) => ({ ...e, building: undefined }));
    };

    const pickPhoto = async () => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert("Максимум фото", `Можно добавить не более ${MAX_PHOTOS} фото`);
            return;
        }
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Нет доступа", "Разрешите доступ к галерее в настройках.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - photos.length,
            allowsEditing: false,
            quality: 0.8,
        });
        if (!result.canceled) {
            const uris = result.assets.map((a) => a.uri);
            setPhotos((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
        }
    };

    const removePhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    const validate = () => {
        const newErrors: typeof errors = {};
        if (!buildingKey) newErrors.building = "Выберите дом из списка";
        if (!apartment.trim()) newErrors.apartment = "Укажите номер квартиры";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const onSubmit = async () => {
        if (!validate()) return;
        if (!pdConsent) {
            Alert.alert("Согласие нужно", "Отметьте согласие на обработку персональных данных.");
            return;
        }
        if (!photos.length) {
            Alert.alert("Фото нужно", "Прикрепите фото документа.");
            return;
        }

        setSubmitting(true);
        let docUrls: string[];
        try {
            docUrls = await Promise.all(photos.map((uri) => uploadFile(uri)));
        } catch {
            setSubmitting(false);
            Alert.alert("Ошибка", "Не удалось загрузить фото. Проверьте соединение.");
            return;
        }

        const entrance = entranceStr.trim() ? parseInt(entranceStr, 10) : undefined;
        const r = await addApartment({
            buildingKey,
            apartment: apartment.trim(),
            entrance: entrance && !isNaN(entrance) ? entrance : undefined,
            docType,
            docUrls,
        });
        setSubmitting(false);

        if (!r.ok) {
            Alert.alert("Ошибка", (r as { ok: false; reason: string }).reason);
        } else {
            Alert.alert(
                "Заявка отправлена",
                "Квартира добавлена и ожидает подтверждения управляющей компанией.",
                [{ text: "OK", onPress: () => navigation.goBack() }],
            );
        }
    };

    return (
        <ScreenLayout
            title="Добавить квартиру"
            subtitle="Заявка на подтверждение"
            onBack={() => navigation.goBack()}
        >
            {/* Адрес */}
            <SectionHeader icon="location-outline" title="Адрес" />
            <Card>
                <AddressAutocomplete
                    label="Дом"
                    placeholder="Начните вводить адрес..."
                    value={building}
                    onChangeText={(t) => {
                        setBuilding(t);
                        setBuildingKey("");
                    }}
                    onSelectSuggestion={onSelectBuilding}
                    error={errors.building}
                />
                <View style={styles.row}>
                    <View style={styles.rowItem}>
                        <Input
                            label="Квартира"
                            placeholder="42"
                            value={apartment}
                            onChangeText={(t) => {
                                setApartment(t);
                                setErrors((e) => ({ ...e, apartment: undefined }));
                            }}
                            keyboardType="numeric"
                            error={errors.apartment}
                        />
                    </View>
                    <View style={styles.rowItem}>
                        <Input
                            label="Подъезд (необяз.)"
                            placeholder="1"
                            value={entranceStr}
                            onChangeText={setEntranceStr}
                            keyboardType="numeric"
                        />
                    </View>
                </View>
            </Card>

            {/* Тип документа */}
            <SectionHeader icon="document-outline" title="Тип документа" color={colors.accent} />
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
                            <Text style={[textStyles.caption, styles.docHint]}>{dt.hint}</Text>
                            {active && (
                                <View style={styles.docCheck}>
                                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </View>

            {/* Согласие на ПДн */}
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
                    Согласен на обработку персональных данных для верификации квартиры.
                </Text>
            </Pressable>

            {/* Фото документа */}
            <SectionHeader icon="camera-outline" title="Фото документа" />
            <Card>
                {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                        {photos.map((uri, i) => (
                            <View key={i} style={styles.thumbWrap}>
                                <Image source={{ uri }} style={styles.thumb} />
                                <Pressable onPress={() => removePhoto(i)} style={styles.removeBtn} hitSlop={6}>
                                    <Text style={styles.removeBtnText}>×</Text>
                                </Pressable>
                            </View>
                        ))}
                        {photos.length < MAX_PHOTOS && (
                            <Pressable onPress={() => { void pickPhoto(); }} style={styles.addBtn}>
                                <Text style={styles.addBtnText}>+</Text>
                            </Pressable>
                        )}
                    </ScrollView>
                )}

                {photos.length === 0 && (
                    <Pressable
                        onPress={() => { void pickPhoto(); }}
                        style={({ pressed }) => [styles.uploadArea, pressed && styles.uploadAreaPressed]}
                    >
                        <View style={styles.uploadIconCircle}>
                            <Ionicons name="cloud-upload-outline" size={28} color={colors.info} />
                        </View>
                        <Text style={styles.uploadTitle}>Прикрепить фото</Text>
                        <Text style={styles.uploadHint}>JPEG или PNG · до {MAX_PHOTOS} фото · разборчивый скан или фото</Text>
                    </Pressable>
                )}

                <View style={{ height: spacing.md }} />

                <Button
                    title={submitting ? "Отправка..." : "Отправить заявку"}
                    onPress={() => { void onSubmit(); }}
                    disabled={submitting || !pdConsent || !photos.length}
                    variant="primary"
                />
            </Card>
        </ScreenLayout>
    );
}

const THUMB_SIZE = 90;

const styles = StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.md },
    rowItem: { flex: 1 },

    docTypes: { flexDirection: "row", gap: spacing.md },
    docCard: {
        flex: 1, padding: spacing.md, borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.surface, gap: spacing.sm, position: "relative",
    },
    docCardOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    docCardPressed: { opacity: 0.8 },
    docIconWrap: {
        width: 40, height: 40, borderRadius: radius.md,
        backgroundColor: "rgba(154, 165, 181, 0.12)",
        alignItems: "center", justifyContent: "center",
    },
    docIconWrapOn: { backgroundColor: "rgba(61, 158, 122, 0.2)" },
    docTitle: { color: colors.text, fontSize: 14 },
    docTitleOn: { color: colors.primary },
    docHint: { color: colors.textDim, lineHeight: 16 },
    docCheck: { position: "absolute", top: spacing.sm, right: spacing.sm },

    consentCard: {
        flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
        padding: spacing.lg, borderRadius: radius.lg,
        backgroundColor: "rgba(26, 35, 46, 0.6)", borderWidth: 1, borderColor: colors.border,
    },
    consentCardOn: { borderColor: `${colors.primary}66`, backgroundColor: colors.primarySoft },
    consentPressed: { opacity: 0.85 },
    checkbox: {
        width: 22, height: 22, borderRadius: 6, borderWidth: 2,
        borderColor: colors.border, alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 1,
    },
    checkboxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    consentText: { flex: 1, color: colors.textMuted, lineHeight: 20 },

    photoRow: { flexDirection: "row", marginBottom: spacing.xs },
    thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE, marginRight: spacing.sm, position: "relative" },
    thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: radius.md, backgroundColor: colors.border },
    removeBtn: {
        position: "absolute", top: -6, right: -6,
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
    },
    removeBtnText: { color: "#fff", fontSize: 16, lineHeight: 20, fontWeight: "700" },
    addBtn: {
        width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
        alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
    },
    addBtnText: { color: colors.text, fontSize: 32, lineHeight: 36 },
    uploadArea: {
        borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
        borderRadius: radius.lg, paddingVertical: spacing.xl + 4,
        alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(91, 159, 212, 0.04)",
    },
    uploadAreaPressed: { opacity: 0.75 },
    uploadIconCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: "rgba(91, 159, 212, 0.12)",
        alignItems: "center", justifyContent: "center", marginBottom: spacing.xs,
    },
    uploadTitle: { fontSize: 15, fontWeight: "600", color: colors.info },
    uploadHint: { fontSize: 12, color: colors.textDim },
});
