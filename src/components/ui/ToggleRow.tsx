import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = {
    title: string;
    description?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
};

export function ToggleRow({
    title,
    description,
    value,
    onValueChange,
    icon,
    iconColor = colors.primary,
}: Props) {
    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
            {icon && (
                <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
                    <Ionicons name={icon} size={18} color={iconColor} />
                </View>
            )}
            <View style={styles.texts}>
                <Text style={[textStyles.subtitle, styles.title]}>{title}</Text>
                {!!description && (
                    <Text style={[textStyles.caption, styles.desc]}>
                        {description}
                    </Text>
                )}
            </View>
            <View style={styles.switchWrap}>
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{
                        false: colors.border,
                        true: colors.primaryMuted,
                    }}
                    thumbColor={value ? colors.primary : colors.textDim}
                />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        gap: spacing.md,
    },
    pressed: { backgroundColor: colors.surfaceHover },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    texts: { flex: 1 },
    switchWrap: {
        minWidth: 56,
        alignItems: "flex-end",
    },
    title: { color: colors.text },
    desc: { color: colors.textDim, marginTop: 3, fontSize: 12 },
});
