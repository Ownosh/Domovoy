import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Input } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
    const { login } = useApp();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async () => {
        setErr("");
        if (!email.trim() || !password) {
            setErr("Заполните email и пароль");
            return;
        }
        setLoading(true);
        const ok = await login(email, password);
        setLoading(false);
        if (!ok) {
            setErr("Неверный email или пароль");
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
                <View style={styles.screen}>

                    {/* ── Логотип ── */}
                    <View style={styles.logoSection}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="home" size={38} color={colors.primary} />
                        </View>
                        <Text style={[textStyles.hero, styles.appName]}>Домовой</Text>
                        <Text style={[textStyles.caption, styles.tagline]}>
                            Цифровой помощник жителя
                        </Text>
                    </View>

                    {/* ── Форма ── */}
                    <Card style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={[textStyles.title, styles.cardTitle]}>Вход в аккаунт</Text>
                            <Text style={[textStyles.caption, styles.cardSubtitle]}>
                                Введите email и пароль
                            </Text>
                        </View>

                        <View style={styles.divider} />

                        <Input
                            label="Email"
                            value={email}
                            onChangeText={(v) => { setEmail(v); setErr(""); }}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            autoComplete="email"
                            placeholder="example@mail.ru"
                        />
                        <View style={styles.gap} />
                        <Input
                            label="Пароль"
                            value={password}
                            onChangeText={(v) => { setPassword(v); setErr(""); }}
                            secureTextEntry
                            showPasswordToggle
                            autoComplete="password"
                            placeholder="Введите пароль"
                        />

                        {!!err && (
                            <View style={styles.errorRow}>
                                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                                <Text style={[textStyles.caption, styles.errText]}>{err}</Text>
                            </View>
                        )}

                        <View style={styles.gapLg} />
                        <Button title="Войти" onPress={() => { void onSubmit(); }} loading={loading} />
                    </Card>

                    {/* ── Ссылка на регистрацию ── */}
                    <Pressable
                        onPress={() => navigation.navigate("Register")}
                        style={({ pressed }) => [styles.linkWrap, pressed && styles.linkPressed]}
                    >
                        <Text style={[textStyles.body, styles.link]}>
                            Нет аккаунта?{"  "}
                            <Text style={styles.linkBold}>Зарегистрироваться</Text>
                        </Text>
                    </Pressable>

                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    screen: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
        paddingBottom: spacing.xxxl,
    },

    /* Лого */
    logoSection: {
        alignItems: "center",
        gap: spacing.sm,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: `${colors.primary}44`,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    appName: {
        color: colors.text,
    },
    tagline: {
        color: colors.textMuted,
    },

    /* Карточка */
    card: {
        gap: spacing.md,
    },
    cardHeader: {
        gap: 4,
    },
    cardTitle: {
        color: colors.text,
    },
    cardSubtitle: {
        color: colors.textDim,
    },
    divider: {
        height: 1,
        backgroundColor: colors.borderSubtle,
        marginBottom: spacing.sm,
    },

    /* Ошибка */
    errorRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.dangerSoft,
    },
    errText: {
        color: colors.danger,
        flex: 1,
    },

    /* Ссылка */
    linkWrap: {
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    linkPressed: { opacity: 0.7 },
    link: { color: colors.textMuted, textAlign: "center" },
    linkBold: { color: colors.primary, fontWeight: "700" },

    gap: { height: spacing.md },
    gapLg: { height: spacing.sm },
});
