import type { ProfileScreenProps } from "../../navigation/types";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
    AppealStatusBadge,
    Card,
    ScreenLayout,
} from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { MainTabNavigationProp } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"AppealHistory">;

export function AppealHistoryScreen({ navigation }: Props) {
    const parent = navigation.getParent<MainTabNavigationProp>();
    const { appeals } = useApp();

    return (
        <ScreenLayout
            title="История обращений"
            subtitle="Те же заявления, что в разделе «Обращения»"
            scroll={false}
            contentStyle={styles.flex}
            onBack={() => navigation.goBack()}
        >
            <FlatList
                data={appeals}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={[textStyles.body, styles.empty]}>
                        Обращений пока нет
                    </Text>
                }
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() =>
                            parent?.navigate("Appeals", {
                                screen: "AppealDetail",
                                params: { id: item.id },
                            })
                        }
                    >
                        <Card style={styles.row}>
                            <View style={styles.rowTop}>
                                <AppealStatusBadge status={item.status} />
                                <Text
                                    style={[textStyles.caption, styles.date]}
                                >
                                    {new Date(item.createdAt).toLocaleDateString(
                                        "ru-RU",
                                    )}
                                </Text>
                            </View>
                            <Text
                                style={[textStyles.subtitle, styles.title]}
                            >
                                {item.title}
                            </Text>
                            <Text
                                style={[textStyles.caption, styles.cat]}
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

const styles = StyleSheet.create({
    flex: { flex: 1 },
    list: { gap: spacing.md, paddingBottom: spacing.xxxl },
    row: { gap: spacing.sm },
    rowTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    date: { color: colors.textDim },
    title: { color: colors.text },
    cat: { color: colors.textMuted },
    empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
