import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, ScreenLayout } from "../../components/ui";
import type { SafetyStackParamList } from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<SafetyStackParamList, "RightsUk">;

export function RightsUkScreen({ navigation }: Props) {
    return (
        <ScreenLayout
            title="УК"
            subtitle="Права и обязанности"
            onBack={() => navigation.goBack()}
        >
            <Card padded>
                <Text style={[textStyles.subtitle, styles.title]}>
                    Кратко о важном
                </Text>
                <View style={styles.list}>
                    {[
                        "Обеспечивать надлежащее содержание общего имущества и выполнение договорных обязательств.",
                        "Оперативно реагировать на аварийные ситуации и обеспечивать диспетчеризацию.",
                        "Информировать жителей о плановых работах, отключениях и изменениях в обслуживании.",
                        "Предоставлять отчётность по выполненным работам и расходованию средств (в рамках договоров и закона).",
                        "Соблюдать сроки и качество работ, привлекать подрядчиков с контролем результата.",
                    ].map((txt, i) => (
                        <View key={i} style={styles.row}>
                            <Text style={[textStyles.body, styles.bullet]}>{"•"}</Text>
                            <Text style={[textStyles.body, styles.text]}>{txt}</Text>
                        </View>
                    ))}
                </View>
                <Text style={[textStyles.caption, styles.note]}>
                    Это демо‑памятка. В рабочей версии можно добавить ссылки на нормы и ваш
                    договор управления.
                </Text>
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    title: { color: colors.text, marginBottom: spacing.sm },
    list: { gap: spacing.sm },
    row: { flexDirection: "row", gap: spacing.sm },
    bullet: { color: colors.textDim, width: 16 },
    text: { color: colors.text, flex: 1, lineHeight: 22 },
    note: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 18 },
});

