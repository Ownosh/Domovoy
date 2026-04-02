import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { colors, spacing, textStyles } from "../../theme";

type Props = {
    title: string;
    description?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
};

export function ToggleRow({
    title,
    description,
    value,
    onValueChange,
}: Props) {
    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
            <View style={styles.texts}>
                <Text style={[textStyles.subtitle, styles.title]}>{title}</Text>
                {!!description && (
                    <Text style={[textStyles.caption, styles.desc]}>
                        {description}
                    </Text>
                )}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{
                    false: colors.border,
                    true: colors.primaryMuted,
                }}
                thumbColor={value ? colors.primary : colors.textDim}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.md,
        gap: spacing.md,
    },
    pressed: { opacity: 0.85 },
    texts: { flex: 1 },
    title: { color: colors.text },
    desc: { color: colors.textMuted, marginTop: spacing.xs },
});
