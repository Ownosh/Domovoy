import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = { text: string; defaultOpen?: boolean };

export function CollapsibleHint({ text, defaultOpen = true }: Props) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <View style={styles.wrap}>
            <Pressable
                onPress={() => setOpen((v) => !v)}
                style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
            >
                <Ionicons name="information-circle-outline" size={15} color={colors.info} />
                <Text style={styles.label}>Подсказка</Text>
                <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={15}
                    color={colors.textDim}
                />
            </Pressable>
            {open && (
                <Text style={[textStyles.caption, styles.text]}>{text}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        backgroundColor: `${colors.info}0d`,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: `${colors.info}2a`,
        overflow: "hidden",
        marginBottom: spacing.sm,
        alignSelf: "flex-end",
        maxWidth: "78%",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    headerPressed: { opacity: 0.7 },
    label: {
        flex: 1,
        fontSize: 11,
        fontWeight: "700",
        color: colors.info,
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    text: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        color: colors.textDim,
        lineHeight: 19,
    },
});
