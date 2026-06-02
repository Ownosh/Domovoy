import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
    const [building, setBuilding] = useState(profile.building);
    const [buildingKey, setBuildingKey] = useState("");
    const [apartment, setApartment] = useState(profile.apartment);
    const [areaStr, setAreaStr] = useState(
        profile.apartmentAreaSqm != null
            ? String(profile.apartmentAreaSqm)
            : "",
    );
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [ok, setOk] = useState(false);

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
        const profileData = {
            name: name.trim(),
            phone: phone.trim(),
            building: building.trim(),
            buildingKey: buildingKey || undefined,
            apartment: apartment.trim(),
            apartmentAreaSqm:
                areaStr.trim() === "" || Number.isNaN(areaNum) ? undefined : areaNum,
        };
        try {
            await apiUpdateProfile(profileData);
        } catch {
            // не блокируем сохранение локально если API недоступен
        }
        updateProfile({
            ...profileData,
            building: profileData.buildingKey ?? profileData.building,
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
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    ok: { color: colors.primary, marginTop: spacing.sm },
});
