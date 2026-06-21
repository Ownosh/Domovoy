import type { CommunityScreenProps } from "../../navigation/types";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { colors, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"VoteCreateInfo">;

export function VoteCreateInfoScreen({ navigation }: Props) {
    return (
        <ScreenLayout
            title="Новое голосование"
            subtitle="Как инициировать голосование собственников"
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Text style={[textStyles.body, styles.p]}>
                    Официальное голосование собственников (в т.ч. на платформе ГИС ЖКХ)
                    оформляется через управляющую компанию, председателя совета дома или
                    инициативную группу с подписным листом.
                </Text>
                <Text style={[textStyles.body, styles.p]}>
                    В приложении вы участвуете в уже открытых голосованиях. Чтобы поднять тему,
                    создайте обращение в разделе «Обращения» с категорией, близкой к вашему
                    вопросу, или свяжитесь с УК через контакты в профиле.
                </Text>
                <View style={styles.gap} />
                <Button title="Понятно" onPress={() => navigation.goBack()} />
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    p: { color: colors.text, lineHeight: 22, marginBottom: spacing.md },
    gap: { height: spacing.sm },
});
