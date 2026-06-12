import type { ProfileScreenProps } from "../../navigation/types";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";
import type { BuildingChat } from "../../types";

type Props = ProfileScreenProps<"HouseChat">;

const PLATFORM_INFO: Record<BuildingChat["platform"], { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    telegram: { label: "Telegram", icon: "paper-plane-outline", color: "#229ED9" },
    vk: { label: "VK", icon: "logo-vk", color: "#0077FF" },
    max: { label: "MAX", icon: "chatbubbles-outline", color: "#7C5CFC" },
};

export function HouseChatScreen({ navigation }: Props) {
    const { houseChats } = useApp();

    const openUrl = (url: string) => {
        Linking.openURL(url).catch(() => {});
    };

    return (
        <ScreenLayout title="Домовой чат" onBack={() => navigation.goBack()}>
            <Card style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
                <Text style={[textStyles.body, styles.infoText]}>
                    Это официальный чат жителей вашего дома. Здесь можно обсудить
                    новости, договориться о делах дома и быть на связи с соседями.
                </Text>
            </Card>

            {houseChats.length === 0 ? (
                <Text style={[textStyles.body, styles.empty]}>
                    Официальный чат дома пока не добавлен
                </Text>
            ) : (
                <Card>
                    {houseChats.map((chat, index) => {
                        const info = PLATFORM_INFO[chat.platform];
                        return (
                            <React.Fragment key={chat.platform}>
                                {index > 0 && <View style={styles.divider} />}
                                <Pressable
                                    onPress={() => openUrl(chat.url)}
                                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                                >
                                    <View style={[styles.iconBg, { backgroundColor: info.color }]}>
                                        <Ionicons name={info.icon} size={20} color="#fff" />
                                    </View>
                                    <Text style={[textStyles.subtitle, styles.label]}>
                                        Открыть чат в {info.label}
                                    </Text>
                                    <Ionicons name="open-outline" size={18} color={colors.textDim} />
                                </Pressable>
                            </React.Fragment>
                        );
                    })}
                </Card>
            )}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    infoCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    infoText: { flex: 1, color: colors.textDim },
    empty: { textAlign: "center", marginTop: 40, color: colors.textDim },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
    },
    pressed: { opacity: 0.8 },
    iconBg: {
        width: 36,
        height: 36,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
    },
    label: { flex: 1, color: colors.text },
    divider: {
        height: 1,
        backgroundColor: colors.borderSubtle,
        marginVertical: spacing.sm,
    },
});
