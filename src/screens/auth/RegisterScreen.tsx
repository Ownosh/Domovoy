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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
    name?: string;
    email?: string;
    phone?: string;
    building?: string;
    apartment?: string;
    password?: string;
    password2?: string;
};

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
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [consentErr, setConsentErr] = useState("");

    const sanitizePhone = (value: string) => {
        const digits = value.replace(/\D/g, "");
        let normalized = digits;
        if (normalized.startsWith("8")) {
            normalized = `7${normalized.slice(1)}`;
        }
        if (normalized.length > 11) {
            normalized = normalized.slice(0, 11);
        }
        if (!normalized) {
            return "";
        }
        return `+${normalized}`;
    };

    const isValidRussianPhone = (value: string) => {
        const digits = value.replace(/\D/g, "");
        return digits.length === 11 && digits.startsWith("7");
    };

    const validate = (): boolean => {
        const errors: FieldErrors = {};

        if (!name.trim()) {
            errors.name = "Введите ФИО";
        } else if (name.trim().split(/\s+/).length < 2) {
            errors.name = "Введите фамилию и имя";
        }

        if (!email.trim()) {
            errors.email = "Введите email";
        } else if (!EMAIL_RE.test(email.trim())) {
            errors.email = "Неверный формат email";
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
        }

        if (!password) {
            errors.password = "Введите пароль";
        } else if (password.length < 6) {
            errors.password = "Не менее 6 символов";
        }

        if (!password2) {
            errors.password2 = "Повторите пароль";
        } else if (password !== password2) {
            errors.password2 = "Пароли не совпадают";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const onSubmit = () => {
        setConsentErr("");
        if (!dataConsent) {
            setConsentErr("Нужно согласие на обработку персональных данных");
            return;
        }
        if (!validate()) return;
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
                        <Input
                            label="ФИО"
                            value={name}
                            onChangeText={(v) => { setName(v); setFieldErrors((e) => ({ ...e, name: undefined })); }}
                            error={fieldErrors.name}
                        />
                        <View style={styles.gap} />
                        <Input
                            label="Email"
                            value={email}
                            onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: undefined })); }}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            error={fieldErrors.email}
                        />
                        <View style={styles.gap} />
                        <Input
                            label="Телефон"
                            value={phone}
                            onChangeText={(value) => { setPhone(sanitizePhone(value)); setFieldErrors((e) => ({ ...e, phone: undefined })); }}
                            keyboardType="phone-pad"
                            maxLength={16}
                            placeholder="+7 900 000-00-00"
                            autoComplete="tel"
                            error={fieldErrors.phone}
                        />
                        <View style={styles.gap} />
                        <Input
                            label="Дом или ЖК, адрес"
                            value={building}
                            onChangeText={(v) => { setBuilding(v); setFieldErrors((e) => ({ ...e, building: undefined })); }}
                            placeholder="ЖК, улица, дом"
                            hint='Например: ЖК «Солнечный», пр. Октябрьский, 117'
                            error={fieldErrors.building}
                        />
                        <View style={styles.gap} />
                        <Input
                            label="Квартира"
                            value={apartment}
                            onChangeText={(v) => { setApartment(v); setFieldErrors((e) => ({ ...e, apartment: undefined })); }}
                            error={fieldErrors.apartment}
                        />
                        <View style={styles.gap} />
                        <Input
                            label="Пароль"
                            value={password}
                            onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: undefined })); }}
                            secureTextEntry={!showPassword}
                            error={fieldErrors.password}
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
                            onChangeText={(v) => { setPassword2(v); setFieldErrors((e) => ({ ...e, password2: undefined })); }}
                            secureTextEntry={!showPassword2}
                            error={fieldErrors.password2}
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
                                >
                                    {dataConsent ? (
                                        <Text style={styles.checkboxMark}>✓</Text>
                                    ) : null}
                                </View>
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
                        {!!consentErr && (
                            <Text style={[textStyles.caption, styles.err]}>{consentErr}</Text>
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
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    checkboxMark: {
        color: colors.bg,
        fontSize: 14,
        lineHeight: 18,
        fontWeight: "700",
    },
    consentText: { flex: 1, color: colors.textMuted, lineHeight: 20 },
    policyLink: { color: colors.primary, fontWeight: "600" },
});
