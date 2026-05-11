import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
    const { register } = useApp();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [building, setBuilding] = useState("");
    const [apartment, setApartment] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [dataConsent, setDataConsent] = useState(false);
    const [err, setErr] = useState("");

    const onSubmit = () => {
        setErr("");
        if (!dataConsent) {
            setErr("Нужно согласие на обработку персональных данных");
            return;
        }
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
        register({
            name,
            email,
            phone,
            building,
            apartment,
            password,
            dataConsentAt: new Date().toISOString(),
        });
    };

    return (
        <ScreenLayout
            title="Регистрация"
            subtitle="Создайте доступ к личному кабинету"
            onBack={() => navigation.goBack()}
            scroll={false}
        >
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
            >
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
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
                        />
                        <View style={styles.gap} />
                        <Input
                            label="Пароль"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <View style={styles.passMeta}>
                            <Pressable onPress={() => setShowPassword((v) => !v)}>
                                <Text style={[textStyles.caption, styles.passToggle]}>
                                    {showPassword ? "Скрыть" : "Показать"}
                                </Text>
                            </Pressable>
                        </View>
                        <View style={styles.gap} />
                        <Input
                            label="Повтор пароля"
                            value={password2}
                            onChangeText={setPassword2}
                            secureTextEntry={!showPassword2}
                        />
                        <View style={styles.passMeta}>
                            <Pressable onPress={() => setShowPassword2((v) => !v)}>
                                <Text style={[textStyles.caption, styles.passToggle]}>
                                    {showPassword2 ? "Скрыть" : "Показать"}
                                </Text>
                            </Pressable>
                        </View>
                        <View style={styles.consentRow}>
                            <Pressable
                                onPress={() => setDataConsent((v) => !v)}
                                style={styles.checkboxHit}
                            >
                                <View
                                    style={[
                                        styles.checkbox,
                                        dataConsent && styles.checkboxOn,
                                    ]}
                                />
                            </Pressable>
                            <Text style={[textStyles.caption, styles.consentText]}>
                                Согласие на обработку данных, необходимых для работы
                                приложения: ФИО, email, номер телефона, адрес квартиры
                                (дом и квартира).{" "}
                                <Text
                                    style={styles.policyLink}
                                    onPress={() =>
                                        navigation.navigate("PrivacyPolicy")
                                    }
                                >
                                    Полный текст политики конфиденциальности
                                </Text>
                            </Text>
                        </View>
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
                    <View style={styles.keyboardSpacer} />
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        gap: spacing.lg,
        paddingBottom: spacing.xxxl * 2,
    },
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    passMeta: {
        marginTop: spacing.xs,
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
    },
    passToggle: { color: colors.primary, fontWeight: "600" },
    err: { color: colors.danger, marginTop: spacing.sm },
    linkWrap: { alignItems: "center", marginBottom: spacing.xl },
    keyboardSpacer: { height: spacing.xxxl * 1.5 },
    link: { color: colors.textMuted },
    linkBold: { color: colors.primary, fontWeight: "600" },
    consentRow: {
        marginTop: spacing.sm,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
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
