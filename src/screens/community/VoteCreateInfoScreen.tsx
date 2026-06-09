import type { CommunityScreenProps } from "../../navigation/types";
import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, spacing, textStyles } from "../../theme";

type Props = CommunityScreenProps<"VoteCreateInfo">;

export function VoteCreateInfoScreen({ navigation }: Props) {
    const { ukContacts } = useApp();

    const onCall = () => {
        const raw = (ukContacts?.phone ?? "").replace(/\s/g, "");
        if (!raw) return;
        Linking.openURL(`tel:${raw}`).catch(() => {});
    };

    return (
        <ScreenLayout
            title="Новое голосование"
            subtitle="Как инициировать опрос собственников"
            onBack={() => navigation.goBack()}
        >
            <Card>
                <Text style={[textStyles.body, styles.p]}>
                    Официальное голосование собственников (в т.ч. на платформе ГИС ЖКХ)
                    оформляется через управляющую компанию, председателя совета дома или
                    инициативную группу с подписным листом.
                </Text>
                <Text style={[textStyles.body, styles.p]}>
                    В приложении вы участвуете в уже открытых опросах. Чтобы поднять тему,
                    создайте обращение в разделе «Обращения» с категорией, близкой к вашему
                    вопросу, или свяжитесь с УК напрямую.
                </Text>
                <View style={styles.gap} />
                <Button title="Понятно" onPress={() => navigation.goBack()} />
            </Card>

            {ukContacts?.phone ? (
                <View style={styles.callWrap}>
                    <Button
                        title={`Позвонить в УК · ${ukContacts.phone}`}
                        variant="secondary"
                        onPress={onCall}
                        style={styles.callBtn}
                    />
                </View>
            ) : null}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    p: { color: colors.text, lineHeight: 22, marginBottom: spacing.md },
    gap: { height: spacing.sm },
    callWrap: { alignItems: "center", marginTop: spacing.lg },
    callBtn: { borderRadius: 999, paddingHorizontal: 28 },
});
