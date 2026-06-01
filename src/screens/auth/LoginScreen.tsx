import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AuthStackParamList } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

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
        <ScreenLayout scroll={false}>
            <View style={styles.flex}>
                <Card style={styles.card}>
                    <Text style={[textStyles.hero, styles.formTitle]}>Вход</Text>
                    <Text style={[textStyles.caption, styles.formSubtitle]}>
                        Личный кабинет жителя
                    </Text>
                    <View style={styles.gap} />
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
                    <Button title="Войти" onPress={onSubmit} loading={loading} />
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
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, justifyContent: "center", paddingVertical: spacing.xl },
    card: { gap: spacing.sm, flexDirection: "column" },
    formTitle: { color: colors.text, textAlign: "center" },
    formSubtitle: { color: colors.textMuted, textAlign: "center" },
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    err: { color: colors.danger, marginTop: spacing.sm },
    linkWrap: { marginTop: spacing.xl, alignItems: "center" },
    link: { color: colors.textMuted, textAlign: "center" },
    linkBold: { color: colors.primary, fontWeight: "600" },
    hint: { color: colors.textDim, textAlign: "center", marginTop: spacing.lg },
});
