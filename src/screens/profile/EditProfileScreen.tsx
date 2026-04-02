import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"EditProfile">;

export function EditProfileScreen({ navigation }: Props) {
    const { profile, updateProfile } = useApp();
    const [name, setName] = useState(profile.name);
    const [phone, setPhone] = useState(profile.phone);
    const [building, setBuilding] = useState(profile.building);
    const [apartment, setApartment] = useState(profile.apartment);
    const [ok, setOk] = useState(false);

    const save = () => {
        updateProfile({
            name: name.trim(),
            phone: phone.trim(),
            building: building.trim(),
            apartment: apartment.trim(),
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
                <Input label="ФИО" value={name} onChangeText={setName} />
                <View style={styles.gap} />
                <Input
                    label="Телефон"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />
                <View style={styles.gap} />
                <Input
                    label="Дом или ЖК, адрес"
                    value={building}
                    onChangeText={setBuilding}
                    placeholder="ЖК, улица, дом"
                    hint='Например: ЖК «Солнечный», пр. Октябрьский, 117'
                />
                <View style={styles.gap} />
                <Input
                    label="Квартира"
                    value={apartment}
                    onChangeText={setApartment}
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
