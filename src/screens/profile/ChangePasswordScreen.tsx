import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"ChangePassword">;

export function ChangePasswordScreen({ navigation }: Props) {
    const { changePassword } = useApp();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [again, setAgain] = useState("");
    const [err, setErr] = useState("");

    const submit = () => {
        setErr("");
        if (!current || !next) {
            setErr("Заполните поля");
            return;
        }
        if (next.length < 6) {
            setErr("Новый пароль не короче 6 символов");
            return;
        }
        if (next !== again) {
            setErr("Повтор не совпадает");
            return;
        }
        const ok = changePassword(current, next);
        if (!ok) {
            setErr("Текущий пароль неверен");
            return;
        }
        navigation.goBack();
    };

    return (
        <ScreenLayout
            title="Смена пароля"
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Input
                    label="Текущий пароль"
                    value={current}
                    onChangeText={setCurrent}
                    secureTextEntry
                />
                <View style={styles.gap} />
                <Input
                    label="Новый пароль"
                    value={next}
                    onChangeText={setNext}
                    secureTextEntry
                />
                <View style={styles.gap} />
                <Input
                    label="Повтор нового пароля"
                    value={again}
                    onChangeText={setAgain}
                    secureTextEntry
                />
                {!!err && (
                    <Text style={[textStyles.caption, styles.err]}>{err}</Text>
                )}
                <View style={styles.gapLg} />
                <Button title="Обновить пароль" onPress={submit} />
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
    err: { color: colors.danger, marginTop: spacing.sm },
});
