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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddressAutocomplete, Button, Card, Input } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
    name?: string;
    email?: string;
    phone?: string;
    building?: string;
    apartment?: string;
    entrance?: string;
    password?: string;
    password2?: string;
};

function SectionHeader({ icon, title, color }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    color?: string;
}) {
    const c = color ?? colors.primary;
    return (
        <View style={sh.wrap}>
            <View style={[sh.iconWrap, { backgroundColor: `${c}20` }]}>
                <Ionicons name={icon} size={13} color={c} />
            </View>
            <Text style={[sh.label, { color: c }]}>{title}</Text>
            <View style={sh.line} />
        </View>
    );
}

const sh = StyleSheet.create({
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
        alignItems: "center",
        justifyContent: "center",
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    line: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
});

export function RegisterScreen({ navigation }: Props) {
    const { register } = useApp();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [building, setBuilding] = useState("");
    const [buildingKey, setBuildingKey] = useState("");
    const [apartment, setApartment] = useState("");
    const [entranceStr, setEntranceStr] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [dataConsent, setDataConsent] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [consentErr, setConsentErr] = useState("");

    const clearErr = (field: keyof FieldErrors) =>
        setFieldErrors((e) => ({ ...e, [field]: undefined }));

    const sanitizePhone = (value: string) => {
        const digits = value.replace(/\D/g, "");
        let normalized = digits;
        if (normalized.startsWith("8")) normalized = `7${normalized.slice(1)}`;
        if (normalized.length > 11) normalized = normalized.slice(0, 11);
        return normalized ? `+${normalized}` : "";
    };

    const isValidRussianPhone = (value: string) => {
        const digits = value.replace(/\D/g, "");
        return digits.length === 11 && digits.startsWith("7");
    };

    const validate = (): boolean => {
        const errors: FieldErrors = {};
        if (!name.trim()) errors.name = "Введите ФИО";
        else if (name.trim().split(/\s+/).length < 2) errors.name = "Введите фамилию и имя";

        if (!email.trim()) errors.email = "Введите email";
        else if (!EMAIL_RE.test(email.trim())) errors.email = "Неверный формат email";

        if (!phone.trim()) errors.phone = "Введите номер телефона";
        else if (!isValidRussianPhone(phone)) errors.phone = "Формат: +7XXXXXXXXXX";

        if (!building.trim()) errors.building = "Введите адрес дома";
        else if (!buildingKey) errors.building = "Выберите дом из списка подсказок";

        if (!apartment.trim()) errors.apartment = "Введите номер квартиры";
        else if (!/^\d+$/.test(apartment.trim())) errors.apartment = "Только цифры, например: 42";

        const entranceNum = parseInt(entranceStr.trim(), 10);
        if (!entranceStr.trim()) errors.entrance = "Введите номер подъезда";
        else if (Number.isNaN(entranceNum) || entranceNum <= 0) errors.entrance = "Только цифры, например: 2";

        if (!password) errors.password = "Введите пароль";
        else if (password.length < 6) errors.password = "Не менее 6 символов";

        if (!password2) errors.password2 = "Повторите пароль";
        else if (password !== password2) errors.password2 = "Пароли не совпадают";

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const onSubmit = async () => {
        setConsentErr("");
        if (!dataConsent) {
            setConsentErr("Необходимо согласие на обработку персональных данных");
            return;
        }
        if (!validate()) return;
        setLoading(true);
        try {
            await register({
                name,
                email,
                phone,
                building,
                buildingKey: buildingKey || undefined,
                apartment,
                entrance: parseInt(entranceStr.trim(), 10),
                password,
                dataConsentAt: new Date().toISOString(),
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Ошибка регистрации";
            if (msg.includes("телефон")) setFieldErrors((prev) => ({ ...prev, phone: msg }));
            else if (msg.toLowerCase().includes("email")) setFieldErrors((prev) => ({ ...prev, email: msg }));
            else setConsentErr(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[colors.bg, "#0e151c", colors.bgElevated]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
        >
            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                >
                    <ScrollView
                        contentContainerStyle={styles.scroll}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* ── Шапка ── */}
                        <View style={styles.header}>
                            <View style={styles.logoCircle}>
                                <Ionicons name="home" size={28} color={colors.primary} />
                            </View>
                            <View style={styles.headerText}>
                                <Text style={[textStyles.title, styles.appName]}>Регистрация</Text>
                                <Text style={[textStyles.caption, styles.tagline]}>
                                    Создайте личный кабинет жителя
                                </Text>
                            </View>
                        </View>

                        {/* ── О вас ── */}
                        <Card>
                            <SectionHeader icon="person-outline" title="О вас" color={colors.info} />
                            <Input
                                label="ФИО"
                                value={name}
                                onChangeText={(v) => { setName(v); clearErr("name"); }}
                                placeholder="Иванов Иван Иванович"
                                error={fieldErrors.name}
                            />
                            <View style={styles.gap} />
                            <Input
                                label="Email"
                                value={email}
                                onChangeText={(v) => { setEmail(v); clearErr("email"); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                placeholder="example@mail.ru"
                                error={fieldErrors.email}
                            />
                            <View style={styles.gap} />
                            <Input
                                label="Телефон"
                                value={phone}
                                onChangeText={(v) => { setPhone(sanitizePhone(v)); clearErr("phone"); }}
                                keyboardType="phone-pad"
                                maxLength={16}
                                placeholder="+7 900 000-00-00"
                                autoComplete="tel"
                                error={fieldErrors.phone}
                            />
                        </Card>

                        {/* ── Адрес ── */}
                        <Card>
                            <SectionHeader icon="home-outline" title="Адрес проживания" color={colors.primary} />
                            <AddressAutocomplete
                                label="Дом или ЖК, адрес"
                                value={building}
                                onChangeText={(v) => { setBuilding(v); setBuildingKey(""); clearErr("building"); }}
                                onSelectSuggestion={(item) => {
                                    setBuilding(item.short_name);
                                    setBuildingKey(item.building_key);
                                    clearErr("building");
                                }}
                                placeholder="ЖК «Солнечный», пр. Октябрьский, 117"
                                hint="Начните вводить и выберите из подсказок"
                                error={fieldErrors.building}
                            />
                            <View style={styles.gap} />
                            <View style={styles.row}>
                                <View style={styles.rowHalf}>
                                    <Input
                                        label="Квартира"
                                        value={apartment}
                                        onChangeText={(v) => { setApartment(v.replace(/\D/g, "")); clearErr("apartment"); }}
                                        keyboardType="number-pad"
                                        placeholder="42"
                                        error={fieldErrors.apartment}
                                    />
                                </View>
                                <View style={styles.rowHalf}>
                                    <Input
                                        label="Подъезд"
                                        value={entranceStr}
                                        onChangeText={(v) => { setEntranceStr(v.replace(/\D/g, "")); clearErr("entrance"); }}
                                        keyboardType="number-pad"
                                        placeholder="2"
                                        error={fieldErrors.entrance}
                                    />
                                </View>
                            </View>
                        </Card>

                        {/* ── Безопасность ── */}
                        <Card>
                            <SectionHeader icon="lock-closed-outline" title="Безопасность" color={colors.accent} />
                            <Input
                                label="Пароль"
                                value={password}
                                onChangeText={(v) => { setPassword(v); clearErr("password"); }}
                                secureTextEntry
                                showPasswordToggle
                                placeholder="Не менее 6 символов"
                                error={fieldErrors.password}
                            />
                            <View style={styles.gap} />
                            <Input
                                label="Повтор пароля"
                                value={password2}
                                onChangeText={(v) => { setPassword2(v); clearErr("password2"); }}
                                secureTextEntry
                                showPasswordToggle
                                placeholder="Повторите пароль"
                                error={fieldErrors.password2}
                            />
                        </Card>

                        {/* ── Согласие ── */}
                        <Pressable
                            onPress={() => { setDataConsent((v) => !v); setConsentErr(""); }}
                            style={({ pressed }) => [styles.consentCard, dataConsent && styles.consentCardOn, pressed && styles.consentPressed]}
                        >
                            <View style={[styles.checkbox, dataConsent && styles.checkboxOn]}>
                                {dataConsent && (
                                    <Ionicons name="checkmark" size={14} color={colors.bg} />
                                )}
                            </View>
                            <Text style={[textStyles.caption, styles.consentText]}>
                                Согласен на обработку персональных данных (ФИО, email, телефон, адрес, фото документов для верификации).{"  "}
                                <Text
                                    style={styles.policyLink}
                                    onPress={() => navigation.navigate("PrivacyPolicy")}
                                >
                                    Политика конфиденциальности
                                </Text>
                            </Text>
                        </Pressable>

                        {!!consentErr && (
                            <View style={styles.errorRow}>
                                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                                <Text style={[textStyles.caption, styles.errText]}>{consentErr}</Text>
                            </View>
                        )}

                        {/* ── Кнопка ── */}
                        <Button
                            title={loading ? "Регистрация..." : "Зарегистрироваться"}
                            onPress={() => { void onSubmit(); }}
                            loading={loading}
                        />

                        {/* ── Ссылка на вход ── */}
                        <Pressable
                            onPress={() => navigation.navigate("Login")}
                            style={({ pressed }) => [styles.linkWrap, pressed && styles.linkPressed]}
                        >
                            <Text style={[textStyles.body, styles.link]}>
                                Уже есть аккаунт?{"  "}
                                <Text style={styles.linkBold}>Войти</Text>
                            </Text>
                        </Pressable>

                        <View style={styles.spacer} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl * 2,
        gap: spacing.lg,
    },

    /* Шапка */
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
    },
    logoCircle: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: `${colors.primary}44`,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    headerText: { gap: 3 },
    appName: { color: colors.text },
    tagline: { color: colors.textMuted },

    /* Поля */
    gap: { height: spacing.md },
    row: { flexDirection: "row", gap: spacing.md },
    rowHalf: { flex: 1 },

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
    checkboxOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    consentText: {
        flex: 1,
        color: colors.textMuted,
        lineHeight: 20,
    },
    policyLink: { color: colors.primary, fontWeight: "600" },

    /* Ошибка */
    errorRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.dangerSoft,
    },
    errText: { color: colors.danger, flex: 1 },

    /* Ссылка */
    linkWrap: { alignItems: "center", paddingVertical: spacing.sm },
    linkPressed: { opacity: 0.7 },
    link: { color: colors.textMuted, textAlign: "center" },
    linkBold: { color: colors.primary, fontWeight: "700" },

    spacer: { height: spacing.xxxl },
});
