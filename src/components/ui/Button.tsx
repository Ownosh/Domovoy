import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    ViewStyle,
} from "react-native";
import { colors, radius, spacing, textStyles } from "../../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
    title: string;
    onPress: () => void;
    variant?: Variant;
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
};

export function Button({
    title,
    onPress,
    variant = "primary",
    disabled,
    loading,
    style,
}: Props) {
    const isPrimary = variant === "primary";
    const isDanger = variant === "danger";

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                variant === "primary" && styles.primary,
                variant === "secondary" && styles.secondary,
                variant === "ghost" && styles.ghost,
                variant === "danger" && styles.danger,
                (disabled || loading) && styles.disabled,
                pressed && !disabled && !loading && styles.pressed,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    color={isPrimary || isDanger ? colors.bg : colors.primary}
                />
            ) : (
                <Text
                    style={[
                        textStyles.subtitle,
                        styles.label,
                        isPrimary && styles.labelOnPrimary,
                        isDanger && styles.labelOnPrimary,
                        variant === "secondary" && styles.labelSecondary,
                        variant === "ghost" && styles.labelGhost,
                    ]}
                >
                    {title}
                </Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 52,
    },
    primary: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    secondary: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    ghost: {
        backgroundColor: "transparent",
    },
    danger: {
        backgroundColor: colors.danger,
    },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
    label: { fontSize: 15 },
    labelOnPrimary: { color: colors.bg },
    labelSecondary: { color: colors.text },
    labelGhost: { color: colors.primary },
});
