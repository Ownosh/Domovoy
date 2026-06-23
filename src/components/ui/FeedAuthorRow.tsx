import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, textStyles } from "../../theme";
import { imageAvatarUrl } from "../../utils/imageUrl";

type Props = {
    name: string;
    photo?: string;
    sub?: string;
};

const AVATAR_PALETTE = [
    "#e05d5d", "#e8a23d", "#3d9e7a", "#5b9fd4",
    "#9b6fd4", "#d45b9f", "#d4a853", "#5bb8d4",
];

function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = name.charCodeAt(i) + ((h << 5) - h);
    }
    return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] ?? "?").toUpperCase();
}

export function FeedAuthorRow({ name, photo, sub }: Props) {
    const bgColor = avatarColor(name);
    return (
        <View style={styles.row}>
            {photo ? (
                <Image
                    source={{ uri: imageAvatarUrl(photo, 56) }}
                    style={styles.avatar}
                    contentFit="cover"
                    cachePolicy="none"
                    transition={100}
                />
            ) : name === "УК" ? (
                <View style={[styles.avatar, styles.avatarUk]}>
                    <Ionicons name="business-outline" size={16} color="#1a5f9a" />
                </View>
            ) : (
                <View style={[styles.avatar, { backgroundColor: `${bgColor}33`, borderWidth: 1, borderColor: `${bgColor}55` }]}>
                    <Text style={[styles.avatarInitial, { color: bgColor }]}>{initials(name)}</Text>
                </View>
            )}
            <View style={styles.nameCol}>
                <Text style={[textStyles.caption, styles.name]} numberOfLines={1}>{name}</Text>
                {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
            </View>
        </View>
    );
}

export function AvatarThumb({ name, photo, size = 52 }: { name: string; photo?: string; size?: number }) {
    const bgColor = avatarColor(name);
    const r = size / 2;
    if (photo) {
        return (
            <Image
                source={{ uri: imageAvatarUrl(photo, size * 2) }}
                style={{ width: size, height: size, borderRadius: r, backgroundColor: colors.border }}
                contentFit="cover"
                cachePolicy="none"
                transition={100}
            />
        );
    }
    if (name === "УК") {
        return (
            <View style={{ width: size, height: size, borderRadius: r, backgroundColor: "rgba(91,159,212,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="business-outline" size={size * 0.42} color={colors.info} />
            </View>
        );
    }
    return (
        <View style={{ width: size, height: size, borderRadius: r, backgroundColor: `${bgColor}33`, borderWidth: 1, borderColor: `${bgColor}55`, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: size * 0.36, fontWeight: "700", color: bgColor }}>{initials(name)}</Text>
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
    avatar: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    avatarUk: { backgroundColor: "rgba(26, 95, 154, 0.18)" },
    avatarInitial: { fontSize: 11, fontWeight: "700" },
    nameCol: { flex: 1 },
    name: { color: colors.textMuted, fontWeight: "600" },
    sub: { fontSize: 11, color: colors.textDim },
});
