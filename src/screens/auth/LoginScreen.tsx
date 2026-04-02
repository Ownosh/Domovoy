import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
    const { login, hasAccount } = useApp();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");

    const onSubmit = () => {
        setErr("");
        if (!email.trim() || !password) {
            setErr("Заполните email и пароль");
            return;
        }
        if (!hasAccount) {
            setErr("Сначала создайте учётную запись");
            return;
        }
        const ok = login(email, password);
        if (!ok) {
            setErr("Неверный email или пароль");
            return;
        }
    };

    return (
        <ScreenLayout
            title="Вход"
            subtitle="Личный кабинет жителя"
            scroll={false}
        >
            <View style={styles.flex}>
                <Card style={styles.card}>
                    <Input
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                    />
                    <View style={styles.gap} />
                    <Input
                        label="Пароль"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="password"
                    />
                    {!!err && (
                        <Text style={[textStyles.caption, styles.err]}>
                            {err}
                        </Text>
                    )}
                    <View style={styles.gapLg} />
                    <Button title="Войти" onPress={onSubmit} />
                </Card>
                <Pressable
                    onPress={() => navigation.navigate("Register")}
                    style={styles.linkWrap}
                >
                    <Text style={[textStyles.body, styles.link]}>
                        Нет аккаунта?{" "}
                        <Text style={styles.linkBold}>Регистрация</Text>
                    </Text>
                </Pressable>
                {!hasAccount && (
                    <Text style={[textStyles.caption, styles.hint]}>
                        При первом запуске создайте учётную запись — данные
                        сохраняются только на устройстве (демо без сервера).
                    </Text>
                )}
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, justifyContent: "center", paddingVertical: spacing.xl },
    card: { gap: spacing.sm, flexDirection: "column" },
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    err: { color: colors.danger, marginTop: spacing.sm },
    linkWrap: { marginTop: spacing.xl, alignItems: "center" },
    link: { color: colors.textMuted, textAlign: "center" },
    linkBold: { color: colors.primary, fontWeight: "600" },
    hint: { color: colors.textDim, textAlign: "center", marginTop: spacing.lg },
});
