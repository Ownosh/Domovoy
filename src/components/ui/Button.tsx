import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    ViewStyle,
} from "react-native";
import { colors, radius, spacing, textStyles } from "../../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "info";

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
    const isSolid = variant === "primary" || variant === "danger" || variant === "accent" || variant === "info";

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
                variant === "accent" && styles.accent,
                variant === "info" && styles.info,
                (disabled || loading) && styles.disabled,
                pressed && !disabled && !loading && styles.pressed,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={isSolid ? colors.bg : colors.primary} />
            ) : (
                <Text
                    style={[
                        textStyles.subtitle,
                        styles.label,
                        isSolid && styles.labelOnSolid,
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
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 50,
    },
    primary: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.30,
        shadowRadius: 6,
        elevation: 4,
    },
    secondary: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    ghost: { backgroundColor: "transparent" },
    danger: {
        backgroundColor: colors.danger,
        borderWidth: 1,
        borderColor: "#f08b8b",
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    accent: {
        backgroundColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.30,
        shadowRadius: 6,
        elevation: 4,
    },
    info: {
        backgroundColor: colors.info,
        shadowColor: colors.info,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.30,
        shadowRadius: 6,
        elevation: 4,
    },
    disabled: { opacity: 0.42 },
    pressed: { opacity: 0.84, transform: [{ scale: 0.97 }, { translateY: 1 }] },
    label: { fontSize: 15, letterSpacing: 0.3 },
    labelOnSolid: { color: "#fff" },
    labelSecondary: { color: colors.text },
    labelGhost: { color: colors.primary },
});
