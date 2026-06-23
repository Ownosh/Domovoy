import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { uploadAvatar } from "../../api/files";
import { AddressAutocomplete, Button, Card, Input, ProfileAvatar, ScreenLayout } from "../../components/ui";
import type { BuildingSuggestion } from "../../api/buildings";
import { apiUpdateProfile } from "../../api/auth";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";
import { resolveProfilePhotoUrl } from "../../utils/imageUrl";

type Props = ProfileScreenProps<"EditProfile">;

type FieldErrors = {
    name?: string;
    phone?: string;
    building?: string;
    apartment?: string;
};

const isValidRussianPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("7");
};

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
    return (
        <View style={sectionStyles.wrap}>
            <View style={sectionStyles.iconWrap}>
                <Ionicons name={icon} size={14} color={colors.primary} />
            </View>
            <Text style={sectionStyles.label}>{title}</Text>
            <View style={sectionStyles.line} />
        </View>
    );
}

const sectionStyles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    iconWrap: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        color: colors.primary,
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: colors.borderSubtle,
    },
});

export function EditProfileScreen({ navigation }: Props) {
    const { profile, updateProfile, refreshFeed } = useApp();
    const [name, setName] = useState(profile.name);
    const [phone, setPhone] = useState(profile.phone);
    const [building, setBuilding] = useState(profile.buildingName || profile.building);
    const [buildingKey, setBuildingKey] = useState(profile.building || "");
    const [apartment, setApartment] = useState(profile.apartment);
    const [entranceStr, setEntranceStr] = useState(
        profile.entrance != null ? String(profile.entrance) : "",
    );
    const [photoUri, setPhotoUri] = useState<string | null>(profile.profilePhoto ?? null);
    const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [saving, setSaving] = useState(false);
    const [ok, setOk] = useState(false);

    const pickPhoto = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Нет доступа", "Разрешите доступ к галерее в настройках.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
        });
        if (!result.canceled && result.assets[0]) {
            const raw = result.assets[0].uri;
            setPhotoUri(raw);
            setNewPhotoUri(raw);
        }
    };

    const clearError = (field: keyof FieldErrors) =>
        setFieldErrors((e) => ({ ...e, [field]: undefined }));

    const validate = (): boolean => {
        const errors: FieldErrors = {};

        if (!name.trim()) {
            errors.name = "Введите ФИО";
        } else if (name.trim().split(/\s+/).length < 2) {
            errors.name = "Введите фамилию и имя";
        }

        if (!phone.trim()) {
            errors.phone = "Введите номер телефона";
        } else if (!isValidRussianPhone(phone)) {
            errors.phone = "Формат: +7XXXXXXXXXX";
        }

        if (!building.trim()) {
            errors.building = "Введите адрес дома";
        } else if (
            building.trim() !== (profile.buildingName || profile.building).trim() &&
            !buildingKey
        ) {
            errors.building = "Выберите дом из списка подсказок";
        }

        if (!apartment.trim()) {
            errors.apartment = "Введите номер квартиры";
        } else if (!/^\d+$/.test(apartment.trim())) {
            errors.apartment = "Только цифры, например: 42";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const save = async () => {
        setOk(false);
        if (!validate()) return;

        const entranceNum = parseInt(entranceStr.trim(), 10);
        const nextEntrance =
            entranceStr.trim() !== "" && !Number.isNaN(entranceNum) && entranceNum > 0
                ? entranceNum
                : undefined;

        const photoChanged = !!newPhotoUri || photoUri === null;
        const originalBuildingLabel = (profile.buildingName || profile.building).trim();
        const buildingLabel = building.trim();
        const addressChanged =
            buildingLabel !== originalBuildingLabel ||
            apartment.trim() !== (profile.apartment ?? "").trim() ||
            nextEntrance !== profile.entrance;
        const resolvedBuildingKey = buildingKey || profile.building;
        const phoneChanged = phone.trim() !== (profile.phone ?? "").trim();

        const apiPayload: Parameters<typeof apiUpdateProfile>[0] = {
            name: name.trim(),
        };
        if (phoneChanged) apiPayload.phone = phone.trim();
        if (addressChanged) {
            apiPayload.building = buildingLabel;
            if (buildingKey) apiPayload.buildingKey = buildingKey;
            apiPayload.apartment = apartment.trim();
            if (nextEntrance != null) apiPayload.entrance = nextEntrance;
        }

        const localPatch: Parameters<typeof updateProfile>[0] = {
            name: name.trim(),
            phone: phone.trim(),
        };
        if (addressChanged) {
            localPatch.building = resolvedBuildingKey;
            localPatch.buildingName = buildingLabel;
            localPatch.apartment = apartment.trim();
            localPatch.entrance = nextEntrance;
        }
        if (photoChanged && photoUri === null) {
            localPatch.profilePhoto = undefined;
            localPatch.profilePhotoPreviewUri = undefined;
            apiPayload.profilePhoto = null;
        }

        setSaving(true);

        if (photoChanged && newPhotoUri) {
            try {
                const { url, localUri } = await uploadAvatar(newPhotoUri);
                apiPayload.profilePhoto = url;
                localPatch.profilePhoto = url;
                localPatch.profilePhotoPreviewUri = localUri;
                // Дождаться, пока фото реально откроется с текущего API-хоста
                await Image.prefetch(resolveProfilePhotoUrl(url));
            } catch (e: any) {
                setSaving(false);
                Alert.alert("Ошибка", e?.message ?? "Не удалось загрузить фото. Попробуйте ещё раз.");
                return;
            }
        }

        let savedPhoto: string | null | undefined;
        try {
            const res = await apiUpdateProfile(apiPayload);
            savedPhoto = res.profilePhoto;
        } catch (e: any) {
            setSaving(false);
            if (e?.message?.includes("телефон")) {
                setFieldErrors((prev) => ({ ...prev, phone: e.message }));
                return;
            }
            Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить профиль");
            return;
        }

        if (typeof savedPhoto === "string" && savedPhoto) {
            localPatch.profilePhoto = savedPhoto;
        }

        localPatch.profilePhotoPreviewUri = undefined;
        updateProfile(localPatch);
        void refreshFeed();
        setSaving(false);
        setOk(true);
        setTimeout(() => navigation.goBack(), 700);
    };

    return (
        <ScreenLayout
            title="Личные данные"
            subtitle="Редактирование профиля"
            onBack={() => {
                if (saving) return;
                navigation.goBack();
            }}
        >
            {/* ── Аватар ── */}
            <View style={styles.avatarSection}>
                <Pressable
                    onPress={() => { void pickPhoto(); }}
                    style={({ pressed }) => [styles.avatarWrap, pressed && styles.avatarPressed]}
                >
                    <ProfileAvatar
                        uri={photoUri ?? undefined}
                        previewUri={newPhotoUri ?? undefined}
                        name={name || "Житель"}
                        size={88}
                        style={styles.avatar}
                    />
                    <View style={styles.avatarEditBadge}>
                        <Ionicons name="camera" size={14} color={colors.bg} />
                    </View>
                </Pressable>
                <Text style={styles.avatarHint}>
                    Нажмите чтобы изменить фото
                </Text>
            </View>

            {/* ── Личные данные ── */}
            <Card>
                <SectionHeader icon="person-outline" title="Контактные данные" />
                <Input
                    label="ФИО"
                    value={name}
                    onChangeText={(v) => { setName(v); clearError("name"); }}
                    placeholder="Иванов Иван Иванович"
                    error={fieldErrors.name}
                />
                <View style={styles.gap} />
                <Input
                    label="Телефон"
                    value={phone}
                    onChangeText={(v) => { setPhone(v); clearError("phone"); }}
                    keyboardType="phone-pad"
                    placeholder="+7XXXXXXXXXX"
                    error={fieldErrors.phone}
                />
            </Card>

            {/* ── Адрес ── */}
            <Card>
                <SectionHeader icon="home-outline" title="Адрес проживания" />
                <AddressAutocomplete
                    label="Дом или ЖК, адрес"
                    value={building}
                    onChangeText={(v) => { setBuilding(v); setBuildingKey(""); clearError("building"); }}
                    onSelectSuggestion={(item: BuildingSuggestion) => {
                        setBuilding(item.short_name);
                        setBuildingKey(item.building_key);
                        clearError("building");
                    }}
                    placeholder="ЖК «Солнечный», пр. Октябрьский, 117"
                    hint='Начните вводить и выберите из подсказок'
                    error={fieldErrors.building}
                />
                <View style={styles.gap} />
                <View style={styles.row}>
                    <View style={styles.rowHalf}>
                        <Input
                            label="Квартира"
                            value={apartment}
                            onChangeText={(v) => { setApartment(v.replace(/\D/g, "")); clearError("apartment"); }}
                            keyboardType="number-pad"
                            placeholder="42"
                            error={fieldErrors.apartment}
                        />
                    </View>
                    <View style={styles.rowHalf}>
                        <Input
                            label="Подъезд"
                            value={entranceStr}
                            onChangeText={(v) => setEntranceStr(v.replace(/\D/g, ""))}
                            keyboardType="number-pad"
                            placeholder="2"
                            hint="Необязательно"
                        />
                    </View>
                </View>
            </Card>

            {/* ── Кнопка ── */}
            {ok ? (
                <View style={styles.successRow}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark" size={18} color={colors.bg} />
                    </View>
                    <Text style={[textStyles.subtitle, styles.successText]}>
                        Данные сохранены
                    </Text>
                </View>
            ) : (
                <Button
                    title={
                        saving
                            ? newPhotoUri
                                ? "Загрузка фото..."
                                : "Сохранение..."
                            : "Сохранить изменения"
                    }
                    onPress={() => { void save(); }}
                    loading={saving}
                    disabled={saving}
                />
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    /* Avatar */
    avatarSection: {
        alignItems: "center",
        gap: spacing.sm,
    },
    avatarWrap: {
        position: "relative",
    },
    avatarPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    avatar: {
        borderWidth: 2,
        borderColor: colors.primary,
    },
    avatarEditBadge: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.primary,
        borderWidth: 2,
        borderColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarHint: {
        fontSize: 12,
        color: colors.textDim,
    },

    /* Layout */
    gap: { height: spacing.md },
    row: {
        flexDirection: "row",
        gap: spacing.md,
    },
    rowHalf: { flex: 1 },

    /* Success */
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
    successText: {
        color: colors.primary,
    },
});
