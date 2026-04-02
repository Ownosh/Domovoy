import type { AppealsScreenProps } from "../../navigation/types";
import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
    AppealStatusBadge,
    Button,
    Card,
    ScreenLayout,
} from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";

type Props = AppealsScreenProps<"AppealDetail">;

export function AppealDetailScreen({ route, navigation }: Props) {
    const { appeals, deleteAppeal } = useApp();
    const item = appeals.find((a) => a.id === route.params.id);

    if (!item) {
        return (
            <ScreenLayout
                title="Обращение"
                onBack={() => navigation.goBack()}
            >
                <Text style={[textStyles.body, styles.miss]}>
                    Запись не найдена
                </Text>
                <Button title="Назад" onPress={() => navigation.goBack()} />
            </ScreenLayout>
        );
    }

    const onDelete = () => {
        Alert.alert(
            "Удалить обращение?",
            "Действие нельзя отменить.",
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Удалить",
                    style: "destructive",
                    onPress: () => {
                        deleteAppeal(item.id);
                        navigation.popToTop();
                    },
                },
            ],
        );
    };

    return (
        <ScreenLayout
            title="Обращение"
            scroll
            onBack={() => navigation.goBack()}
        >
            <Card>
                <View style={styles.top}>
                    <AppealStatusBadge status={item.status} />
                </View>
                <Text style={[textStyles.caption, styles.meta]}>
                    {item.category} · {formatDate(item.createdAt)}
                </Text>
                <Text style={[textStyles.title, styles.title]}>{item.title}</Text>
                <Text style={[textStyles.body, styles.body]}>{item.body}</Text>
            </Card>
            <Button variant="danger" title="Удалить обращение" onPress={onDelete} />
        </ScreenLayout>
    );
}

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("ru-RU");
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    miss: { color: colors.textMuted },
    top: { marginBottom: spacing.sm },
    meta: { color: colors.textMuted },
    title: { color: colors.text, marginTop: spacing.sm },
    body: { color: colors.text, marginTop: spacing.md },
});
