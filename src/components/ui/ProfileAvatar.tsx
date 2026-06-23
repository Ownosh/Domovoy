import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors } from "../../theme";
import { avatarDisplayUrl, resolveProfilePhotoUrl } from "../../utils/imageUrl";

type Props = {
    uri?: string;
    previewUri?: string;
    name: string;
    size?: number;
    style?: StyleProp<ViewStyle>;
    onRemoteReady?: () => void;
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

export function ProfileAvatar({
    uri,
    previewUri,
    name,
    size = 80,
    style,
    onRemoteReady,
}: Props) {
    const [remoteLoaded, setRemoteLoaded] = useState(false);
    const [remoteFailed, setRemoteFailed] = useState(false);
    const radius = size / 2;

    const remoteSrc = useMemo(() => {
        if (!uri) return null;
        if (uri.startsWith("file:")) return uri;
        return avatarDisplayUrl(resolveProfilePhotoUrl(uri), size * 2);
    }, [uri, size]);

    useEffect(() => {
        setRemoteLoaded(false);
        setRemoteFailed(false);
    }, [remoteSrc, previewUri]);

    const showPreview = !!previewUri && (!remoteLoaded || remoteFailed);
    const showRemote = !!remoteSrc && !remoteFailed;

    if (!remoteSrc && !previewUri) {
        const bg = avatarColor(name);
        return (
            <View
                style={[
                    styles.fallback,
                    { width: size, height: size, borderRadius: radius, backgroundColor: `${bg}33` },
                    style,
                ]}
            >
                <Text style={[styles.initials, { fontSize: size * 0.35, color: bg }]}>
                    {initials(name)}
                </Text>
            </View>
        );
    }

    if (remoteFailed && !previewUri) {
        const bg = avatarColor(name);
        return (
            <View
                style={[
                    styles.fallback,
                    { width: size, height: size, borderRadius: radius, backgroundColor: `${bg}33` },
                    style,
                ]}
            >
                <Text style={[styles.initials, { fontSize: size * 0.35, color: bg }]}>
                    {initials(name)}
                </Text>
            </View>
        );
    }

    return (
        <View style={[{ width: size, height: size, borderRadius: radius, overflow: "hidden" }, style]}>
            {showRemote && (
                <Image
                    source={{ uri: remoteSrc! }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="none"
                    priority="high"
                    recyclingKey={remoteSrc!}
                    transition={remoteLoaded ? 200 : 0}
                    onLoad={() => {
                        setRemoteLoaded(true);
                        if (remoteSrc!.startsWith("http")) onRemoteReady?.();
                    }}
                    onError={() => setRemoteFailed(true)}
                />
            )}
            {showPreview && (
                <Image
                    source={{ uri: previewUri! }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory"
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    fallback: {
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.primary,
    },
    initials: { fontWeight: "700", letterSpacing: -0.5 },
});
