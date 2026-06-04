import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors, spacing, textStyles } from "../../theme";

type Props = {
    name: string;
    photo?: string;
    /** Подпись под именем (например "кв. 12" или "Управляющая компания") */
    sub?: string;
};

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] ?? "?").toUpperCase();
}

export function FeedAuthorRow({ name, photo, sub }: Props) {
    return (
        <View style={styles.row}>
            {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} />
            ) : name === "УК" ? (
                <View style={[styles.avatar, styles.avatarUk]}>
                    <Ionicons name="business-outline" size={16} color={colors.info} />
                </View>
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{initials(name)}</Text>
                </View>
            )}
            <View>
                <Text style={[textStyles.caption, styles.name]} numberOfLines={1}>{name}</Text>
                {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
    },
    avatar: {
        width: 28, height: 28, borderRadius: 14,
        overflow: "hidden",
    },
    avatarPlaceholder: {
        backgroundColor: colors.primarySoft,
        alignItems: "center", justifyContent: "center",
    },
    avatarUk: {
        backgroundColor: "rgba(91, 159, 212, 0.15)",
        alignItems: "center", justifyContent: "center",
    },
    avatarInitial: { fontSize: 11, fontWeight: "700", color: colors.primary },
    name: { color: colors.textMuted, fontWeight: "600" },
    sub: { fontSize: 11, color: colors.textDim },
});
