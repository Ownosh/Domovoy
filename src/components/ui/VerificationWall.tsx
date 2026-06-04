import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, spacing, textStyles } from "../../theme";

type Props = {
    message?: string;
};

export function VerificationWall({ message }: Props) {
    const nav = useNavigation();

    const goVerify = () => {
        // VerificationScreen добавлен в CommunityNavigator и AppealsNavigator,
        // поэтому просто навигируем локально — пользователь сможет вернуться назад.
        (nav as any).navigate("Verification");
    };

    return (
        <View style={styles.wrap}>
            <Ionicons name="shield-outline" size={52} color={colors.textDim} />
            <Text style={[textStyles.subtitle, styles.title]}>Нужна верификация</Text>
            <Text style={[textStyles.body, styles.sub]}>
                {message ?? "Эта функция доступна только для верифицированных жильцов дома."}
            </Text>
            <Button
                title="Пройти верификацию"
                variant="info"
                onPress={goVerify}
                style={styles.btn}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
    },
    title: { color: colors.text, textAlign: "center" },
    sub: { color: colors.textMuted, textAlign: "center", lineHeight: 22 },
    btn: { width: "100%", marginTop: spacing.sm },
});
