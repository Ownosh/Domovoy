import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
    const { register, hasAccount } = useApp();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [building, setBuilding] = useState("");
    const [apartment, setApartment] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [err, setErr] = useState("");

    const onSubmit = () => {
        setErr("");
        if (
            !name.trim() ||
            !email.trim() ||
            !phone.trim() ||
            !building.trim() ||
            !apartment.trim() ||
            !password
        ) {
            setErr("Заполните все поля");
            return;
        }
        if (password.length < 6) {
            setErr("Пароль не короче 6 символов");
            return;
        }
        if (password !== password2) {
            setErr("Пароли не совпадают");
            return;
        }
        if (hasAccount) {
            Alert.alert(
                "Учётная запись уже есть",
                "Удалите текущий аккаунт в профиле или войдите под существующим email.",
            );
            return;
        }
        register({
            name,
            email,
            phone,
            building,
            apartment,
            password,
        });
    };

    return (
        <ScreenLayout
            title="Регистрация"
            subtitle="Создайте доступ к личному кабинету"
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Input label="ФИО" value={name} onChangeText={setName} />
                <View style={styles.gap} />
                <Input
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
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
                    placeholder="напр. 42"
                />
                <View style={styles.gap} />
                <Input
                    label="Пароль"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
                <View style={styles.gap} />
                <Input
                    label="Повтор пароля"
                    value={password2}
                    onChangeText={setPassword2}
                    secureTextEntry
                />
                {!!err && (
                    <Text style={[textStyles.caption, styles.err]}>{err}</Text>
                )}
                <View style={styles.gapLg} />
                <Button title="Зарегистрироваться" onPress={onSubmit} />
            </Card>
            <Pressable
                onPress={() => navigation.navigate("Login")}
                style={styles.linkWrap}
            >
                <Text style={[textStyles.body, styles.link]}>
                    Уже есть аккаунт? <Text style={styles.linkBold}>Войти</Text>
                </Text>
            </Pressable>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    err: { color: colors.danger, marginTop: spacing.sm },
    linkWrap: { alignItems: "center", marginBottom: spacing.xl },
    link: { color: colors.textMuted },
    linkBold: { color: colors.primary, fontWeight: "600" },
});
