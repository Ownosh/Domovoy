import type { ProfileScreenProps, ProfileStackParamList } from "../../navigation/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
    AppealStatusBadge,
    Card,
    ScreenLayout,
} from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";
import { isArchivedAppeal } from "../../utils/appeals";

type Props = ProfileScreenProps<"AppealHistory">;
type Nav = NativeStackNavigationProp<ProfileStackParamList, "AppealHistory">;

export function AppealHistoryScreen({ navigation }: Props) {
    const nav = navigation as unknown as Nav;
    const { appeals } = useApp();
    const archivedAppeals = appeals.filter(isArchivedAppeal);

    return (
        <ScreenLayout
            title="Архив"
            subtitle="Сюда автоматически попадают завершённые обращения"
            scroll={false}
            contentStyle={styles.flex}
            onBack={() => navigation.goBack()}
        >
            <FlatList
                data={archivedAppeals}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={[textStyles.body, styles.empty]}>
                        В архиве пока нет завершённых обращений
                    </Text>
                }
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => nav.navigate("AppealHistoryDetail", { id: item.id })}
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
