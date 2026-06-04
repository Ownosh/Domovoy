import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AddressAutocomplete, Button, Card, Input, ScreenLayout } from "../../components/ui";
import type { BuildingSuggestion } from "../../api/buildings";
import { apiUpdateProfile } from "../../api/auth";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"EditProfile">;

type FieldErrors = {
    name?: string;
    phone?: string;
    building?: string;
    apartment?: string;
    area?: string;
};

const isValidRussianPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("7");
};

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
    const [areaStr, setAreaStr] = useState(
        profile.apartmentAreaSqm != null
            ? String(profile.apartmentAreaSqm)
            : "",
    );
    const [photoUri, setPhotoUri] = useState<string | null>(profile.profilePhoto ?? null);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
            quality: 0.7,
            base64: true,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
            setPhotoBase64(result.assets[0].base64 ?? null);
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

        if (areaStr.trim() !== "") {
            const areaNum = parseFloat(areaStr.replace(",", "."));
            if (Number.isNaN(areaNum) || areaNum <= 0) {
                errors.area = "Укажите корректную площадь";
            }
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const save = async () => {
        setOk(false);
        if (!validate()) return;
        const areaNum = parseFloat(areaStr.replace(",", "."));
        const entranceNum = parseInt(entranceStr.trim(), 10);
        const profilePhotoData = photoBase64
            ? `data:image/jpeg;base64,${photoBase64}`
            : photoUri === null ? null : undefined;

        const profileData = {
            name: name.trim(),
            phone: phone.trim(),
            building: building.trim(),
            buildingKey: buildingKey || undefined,
            apartment: apartment.trim(),
            entrance: entranceStr.trim() !== "" && !Number.isNaN(entranceNum) && entranceNum > 0
                ? entranceNum
                : undefined,
            apartmentAreaSqm:
                areaStr.trim() === "" || Number.isNaN(areaNum) ? undefined : areaNum,
            profilePhoto: profilePhotoData,
        };
        try {
            await apiUpdateProfile(profileData);
        } catch (e: any) {
            if (e?.message?.includes("телефон")) {
                setFieldErrors((prev) => ({ ...prev, phone: e.message }));
                return;
            }
        }
        updateProfile({
            ...profileData,
            building: profileData.buildingKey ?? profileData.building,
            buildingName: profileData.buildingKey ? profileData.building : undefined,
            profilePhoto: profilePhotoData ?? profile.profilePhoto,
        });
        setOk(true);
        setTimeout(() => navigation.goBack(), 600);
    };

    return (
        <ScreenLayout
            title="Личные данные"
            subtitle="Редактирование профиля"
            onBack={() => navigation.goBack()}
        >
            <Pressable onPress={() => { void pickPhoto(); }} style={styles.avatarWrap}>
                {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>
                            {name.trim()[0]?.toUpperCase() ?? "?"}
                        </Text>
                    </View>
                )}
                <View style={styles.avatarEdit}>
                    <Text style={styles.avatarEditText}>Изменить фото</Text>
                </View>
            </Pressable>

            <Card>
                <Input
                    label="ФИО"
                    value={name}
                    onChangeText={(v) => { setName(v); clearError("name"); }}
                    error={fieldErrors.name}
                />
                <View style={styles.gap} />
                <Input
                    label="Телефон"
                    value={phone}
                    onChangeText={(v) => { setPhone(v); clearError("phone"); }}
                    keyboardType="phone-pad"
                    error={fieldErrors.phone}
                />
                <View style={styles.gap} />
                <AddressAutocomplete
                    label="Дом или ЖК, адрес"
                    value={building}
                    onChangeText={(v) => { setBuilding(v); setBuildingKey(""); clearError("building"); }}
                    onSelectSuggestion={(item: BuildingSuggestion) => {
                        setBuilding(item.short_name);
                        setBuildingKey(item.building_key);
                        clearError("building");
                    }}
                    placeholder="ЖК, улица, дом"
                    hint='Например: ЖК «Солнечный», пр. Октябрьский, 117'
                    error={fieldErrors.building}
                />
                <View style={styles.gap} />
                <Input
                    label="Квартира"
                    value={apartment}
                    onChangeText={(v) => { setApartment(v.replace(/\D/g, "")); clearError("apartment"); }}
                    keyboardType="number-pad"
                    error={fieldErrors.apartment}
                />
                <View style={styles.gap} />
                <Input
                    label="Подъезд (необязательно)"
                    value={entranceStr}
                    onChangeText={(v) => setEntranceStr(v.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    placeholder="Например: 2"
                    hint="Используется для коллективных обращений"
                />
                <View style={styles.gap} />
                <Input
                    label="Площадь квартиры, м² (для голосований ОСС)"
                    value={areaStr}
                    onChangeText={(v) => { setAreaStr(v); clearError("area"); }}
                    keyboardType="decimal-pad"
                    placeholder="Например: 54.2"
                    error={fieldErrors.area}
                />
                {ok && (
                    <Text style={[textStyles.caption, styles.ok]}>
                        Сохранено
                    </Text>
                )}
                <View style={styles.gapLg} />
                <Button title="Сохранить" onPress={save} />
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    avatarWrap: { alignItems: "center", marginBottom: spacing.lg },
    avatar: { width: 90, height: 90, borderRadius: 45 },
    avatarPlaceholder: {
        width: 90, height: 90, borderRadius: 45,
        backgroundColor: colors.primarySoft,
        alignItems: "center", justifyContent: "center",
    },
    avatarInitial: { fontSize: 36, fontWeight: "700", color: colors.primary },
    avatarEdit: { marginTop: spacing.sm },
    avatarEditText: { color: colors.primary, fontSize: 13 },
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    ok: { color: colors.primary, marginTop: spacing.sm },
});
