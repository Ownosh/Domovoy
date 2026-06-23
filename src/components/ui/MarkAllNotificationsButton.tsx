import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../../theme";

type Props = {
    visible: boolean;
    onPress: () => void;
};

export function MarkAllNotificationsButton({ visible, onPress }: Props) {
    if (!visible) return null;

    return (
        <Pressable
            onPress={onPress}
            hitSlop={10}
            accessibilityLabel="Прочитать все"
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
            <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    btn: {
        padding: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: colors.primarySoft,
    },
    pressed: { opacity: 0.7 },
});
