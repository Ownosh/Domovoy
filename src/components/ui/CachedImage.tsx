import { Image, type ImageContentFit, type ImageStyle } from "expo-image";
import React from "react";
import { Pressable, StyleProp, StyleSheet } from "react-native";
import { colors } from "../../theme";
import { imageThumbUrl, resolveFeedImageProxyUrl, resolveFeedImageUrl } from "../../utils/imageUrl";

type Props = {
    uri: string;
    style?: StyleProp<ImageStyle>;
    contentFit?: ImageContentFit;
    thumbWidth?: number;
    thumbHeight?: number;
    recyclingKey?: string;
    onPress?: () => void;
    onError?: () => void;
};

export function CachedImage({
    uri,
    style,
    contentFit = "cover",
    thumbWidth = 520,
    thumbHeight = 360,
    recyclingKey,
    onPress,
    onError,
}: Props) {
    const [failed, setFailed] = React.useState(false);
    const [useProxy, setUseProxy] = React.useState(false);

    if (!uri || failed) return null;

    const base = useProxy ? resolveFeedImageProxyUrl(uri) : resolveFeedImageUrl(uri);
    const src = imageThumbUrl(base, thumbWidth, thumbHeight);

    const img = (
        <Image
            source={{ uri: src }}
            style={[styles.base, style]}
            contentFit={contentFit}
            cachePolicy="disk"
            recyclingKey={recyclingKey ?? src}
            transition={150}
            priority="normal"
            onError={() => {
                if (!useProxy) {
                    setUseProxy(true);
                    return;
                }
                setFailed(true);
                onError?.();
            }}
        />
    );

    if (onPress) {
        return (
            <Pressable
                onPress={onPress}
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
                {img}
            </Pressable>
        );
    }
    return img;
}

const styles = StyleSheet.create({
    base: { backgroundColor: colors.borderSubtle },
});
