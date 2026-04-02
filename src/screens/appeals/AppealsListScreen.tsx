import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AppealStatusBadge, Button, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AppealsStackParamList } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

type Nav = NativeStackNavigationProp<AppealsStackParamList>;

export function AppealsListScreen() {
    const navigation = useNavigation<Nav>();
    const { appeals } = useApp();

    return (
        <ScreenLayout
            title="Обращения"
            subtitle="Заявления в управляющую компанию"
            scroll={false}
            contentStyle={styles.flex}
        >
            <Button
                title="Новое обращение"
                onPress={() => navigation.navigate("AppealNew")}
            />
            <FlatList
                data={appeals}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={[textStyles.body, styles.empty]}>
                        Пока нет обращений. Создайте первое.
                    </Text>
                }
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() =>
                            navigation.navigate("AppealDetail", { id: item.id })
                        }
                    >
                        <Card style={styles.row}>
                            <View style={styles.rowTop}>
                                <AppealStatusBadge status={item.status} />
                                <Text
                                    style={[textStyles.caption, styles.date]}
                                >
                                    {formatDate(item.createdAt)}
                                </Text>
                            </View>
                            <Text
                                style={[textStyles.subtitle, styles.title]}
                            >
                                {item.title}
                            </Text>
                            <Text
                                style={[textStyles.caption, styles.category]}
                            >
                                {item.category}
                            </Text>
                        </Card>
                    </Pressable>
                )}
            />
        </ScreenLayout>
    );
}

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    list: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
    row: { gap: spacing.sm },
    rowTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    date: { color: colors.textDim },
    title: { color: colors.text },
    category: { color: colors.textMuted },
    empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
