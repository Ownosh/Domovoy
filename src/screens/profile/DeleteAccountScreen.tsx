import type { ProfileScreenProps } from "../../navigation/types";
import React from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"DeleteAccount">;

export function DeleteAccountScreen({ navigation }: Props) {
    const { deleteAccount } = useApp();

    const confirm = () => {
        Alert.alert(
            "Удалить аккаунт?",
            "Будут удалены профиль и локальные данные на этом устройстве. Обращения из демо также сбросятся.",
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Удалить",
                    style: "destructive",
                    onPress: () => deleteAccount(),
                },
            ],
        );
    };

    return (
        <ScreenLayout
            title="Удаление аккаунта"
            subtitle="Действие необратимо в рамках локального хранилища"
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Text style={[textStyles.body, styles.text]}>
                    После удаления вы сможете зарегистрироваться заново. Пароль и
                    личные данные с устройства будут стёрты.
                </Text>
                <Text style={[textStyles.caption, styles.warn]}>
                    При подключении сервера здесь будет запрос подтверждения у
                    УК и политика хранения данных.
                </Text>
            </Card>
            <Button variant="danger" title="Удалить мой аккаунт" onPress={confirm} />
            <Button
                variant="ghost"
                title="Отмена"
                onPress={() => navigation.goBack()}
            />
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    text: { color: colors.text },
    warn: { color: colors.textDim, marginTop: spacing.md },
});
