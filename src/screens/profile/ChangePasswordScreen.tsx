import type { ProfileScreenProps } from "../../navigation/types";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Input, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { spacing } from "../../theme";

type Props = ProfileScreenProps<"ChangePassword">;

type FieldErrors = {
    current?: string;
    next?: string;
    again?: string;
};

export function ChangePasswordScreen({ navigation }: Props) {
    const { changePassword } = useApp();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [again, setAgain] = useState("");
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const clearError = (field: keyof FieldErrors) =>
        setFieldErrors((e) => ({ ...e, [field]: undefined }));

    const submit = () => {
        const errors: FieldErrors = {};

        if (!current) {
            errors.current = "Введите текущий пароль";
        }

        if (!next) {
            errors.next = "Введите новый пароль";
        } else if (next.length < 6) {
            errors.next = "Не менее 6 символов";
        }

        if (!again) {
            errors.again = "Повторите новый пароль";
        } else if (next && next !== again) {
            errors.again = "Пароли не совпадают";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        const ok = changePassword(current, next);
        if (!ok) {
            setFieldErrors({ current: "Текущий пароль неверен" });
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
                    onChangeText={(v) => { setCurrent(v); clearError("current"); }}
                    secureTextEntry
                    error={fieldErrors.current}
                />
                <View style={styles.gap} />
                <Input
                    label="Новый пароль"
                    value={next}
                    onChangeText={(v) => { setNext(v); clearError("next"); }}
                    secureTextEntry
                    error={fieldErrors.next}
                />
                <View style={styles.gap} />
                <Input
                    label="Повтор нового пароля"
                    value={again}
                    onChangeText={(v) => { setAgain(v); clearError("again"); }}
                    secureTextEntry
                    error={fieldErrors.again}
                />
                <View style={styles.gapLg} />
                <Button title="Обновить пароль" onPress={submit} />
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    gap: { height: spacing.md },
    gapLg: { height: spacing.lg },
});
