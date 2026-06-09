import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { uploadFile } from "../../api/files";
import { AddressAutocomplete, Button, Card, Input, ScreenLayout } from "../../components/ui";
import type { BuildingSuggestion } from "../../api/buildings";
import { apiUpdateProfile } from "../../api/auth";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";

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
    const { profile, updateProfile } = useApp();
    const [name, setName] = useState(profile.name);
    const [phone, setPhone] = useState(profile.phone);
    const [building, setBuilding] = useState(profile.buildingName || profile.building);
    const [buildingKey, setBuildingKey] = useState("");
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
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
            setNewPhotoUri(result.assets[0].uri);
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
        } else if (building.trim() !== (profile.buildingName || profile.building) && !buildingKey) {
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
        setSaving(true);
        const entranceNum = parseInt(entranceStr.trim(), 10);
        let profilePhotoData: string | null | undefined;
        if (newPhotoUri) {
            try {
                profilePhotoData = await uploadFile(newPhotoUri);
            } catch {
                profilePhotoData = undefined;
            }
        } else if (photoUri === null) {
            profilePhotoData = null;
        }

        const phoneChanged = phone.trim() !== (profile.phone ?? "").trim();
        const profileData = {
            name: name.trim(),
            phone: phoneChanged ? phone.trim() : undefined,
            building: building.trim(),
            buildingKey: buildingKey || undefined,
            apartment: apartment.trim(),
            entrance: entranceStr.trim() !== "" && !Number.isNaN(entranceNum) && entranceNum > 0
                ? entranceNum
                : undefined,
            profilePhoto: profilePhotoData,
        };
        try {
            await apiUpdateProfile(profileData);
        } catch (e: any) {
            setSaving(false);
            if (e?.message?.includes("телефон")) {
                setFieldErrors((prev) => ({ ...prev, phone: e.message }));
                return;
            }
            return;
        }
        updateProfile({
            ...profileData,
            phone: phone.trim(),
            building: profileData.buildingKey ?? profileData.building,
            buildingName: profileData.buildingKey ? profileData.building : undefined,
            profilePhoto: profilePhotoData ?? profile.profilePhoto,
        });
        setSaving(false);
        setOk(true);
        setTimeout(() => navigation.goBack(), 700);
    };

    const initials = (name || "Ж")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");

    return (
        <ScreenLayout
            title="Личные данные"
            subtitle="Редактирование профиля"
            onBack={() => navigation.goBack()}
        >
            {/* ── Аватар ── */}
            <View style={styles.avatarSection}>
                <Pressable
                    onPress={() => { void pickPhoto(); }}
                    style={({ pressed }) => [styles.avatarWrap, pressed && styles.avatarPressed]}
                >
                    {photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarInner}>
                            <Text style={styles.avatarInitials}>{initials}</Text>
                        </View>
                    )}
                    <View style={styles.avatarEditBadge}>
                        <Ionicons name="camera" size={14} color={colors.bg} />
                    </View>
                </Pressable>
                <Text style={styles.avatarHint}>Нажмите чтобы изменить фото</Text>
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
                    title={saving ? "Сохранение..." : "Сохранить изменения"}
                    onPress={() => { void save(); }}
                    loading={saving}
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
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    avatarInner: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: colors.primarySoft,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitials: {
        fontSize: 30,
        fontWeight: "700",
        color: colors.primary,
        letterSpacing: -0.5,
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
