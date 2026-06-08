import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import type { AuthenticatedRootParamList } from "../../navigation/types";
import { colors, radius, spacing, textStyles } from "../../theme";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const IMG_H = Math.round(SCREEN_W * 0.62);

type Props = NativeStackScreenProps<AuthenticatedRootParamList, "NewsDetail">;

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function formatDate(dateStr: string): string {
    try {
        const raw = (dateStr ?? "").trim();
        const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
        const d = m
            ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
            : new Date(raw);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
}

function PhotoViewer({
    urls,
    initialIndex,
    visible,
    onClose,
}: {
    urls: string[];
    initialIndex: number;
    visible: boolean;
    onClose: () => void;
}) {
    const scrollRef = useRef<ScrollView>(null);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (!visible) return;
        setCurrentIndex(initialIndex);
        const t = setTimeout(() => {
            scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_W, animated: false });
        }, 50);
        return () => clearTimeout(t);
    }, [visible, initialIndex]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={viewerStyles.backdrop}>
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => {
                        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                        setCurrentIndex(idx);
                    }}
                >
                    {urls.map((url, i) => (
                        <View key={i} style={viewerStyles.page}>
                            <Image
                                source={{ uri: url }}
                                style={viewerStyles.img}
                                resizeMode="contain"
                            />
                        </View>
                    ))}
                </ScrollView>
                <Pressable style={viewerStyles.closeBtn} onPress={onClose} hitSlop={16}>
                    <Ionicons name="close" size={28} color="#fff" />
                </Pressable>
                {urls.length > 1 && (
                    <View style={viewerStyles.dots}>
                        {urls.map((_, i) => (
                            <View
                                key={i}
                                style={[viewerStyles.dot, i === currentIndex && viewerStyles.dotActive]}
                            />
                        ))}
                    </View>
                )}
            </View>
        </Modal>
    );
}

export function NewsDetailScreen({ route, navigation }: Props) {
    const { news } = useApp();
    const item = news.find((n) => n.id === route.params.newsId);
    const scrollRef = useRef<ScrollView>(null);
    const [currentImg, setCurrentImg] = useState(0);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);

    const openViewer = (index: number) => {
        setViewerIndex(index);
        setViewerVisible(true);
    };

    if (!item) {
        return (
            <ScreenLayout title="Новость" onBack={() => navigation.goBack()}>
                <Text style={[textStyles.body, styles.notFound]}>Новость не найдена</Text>
            </ScreenLayout>
        );
    }

    return (
        <ScreenLayout onBack={() => navigation.goBack()} scroll={false}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.meta}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeTxt}>Новости УК</Text>
                    </View>
                    <Text style={[textStyles.caption, styles.date]}>
                        {formatDate(item.date)}
                    </Text>
                </View>

                {item.imageUrls.length > 0 && (
                    <View>
                        <ScrollView
                            ref={scrollRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(e) => {
                                const idx = Math.round(
                                    e.nativeEvent.contentOffset.x / SCREEN_W,
                                );
                                setCurrentImg(idx);
                            }}
                        >
                            {item.imageUrls.map((uri, i) => (
                                <Pressable
                                    key={i}
                                    onPress={() => openViewer(i)}
                                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                                >
                                    <Image
                                        source={{ uri }}
                                        style={styles.galleryImg}
                                        resizeMode="cover"
                                    />
                                </Pressable>
                            ))}
                        </ScrollView>
                        {item.imageUrls.length > 1 && (
                            <View style={styles.dots}>
                                {item.imageUrls.map((_, i) => (
                                    <View
                                        key={i}
                                        style={[styles.dot, i === currentImg && styles.dotActive]}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.content}>
                    <Text style={[textStyles.hero, styles.title]}>{item.title}</Text>
                    <View style={styles.divider} />
                    <Text style={[textStyles.body, styles.body]}>{item.excerpt}</Text>
                </View>
            </ScrollView>

            <PhotoViewer
                urls={item.imageUrls}
                initialIndex={viewerIndex}
                visible={viewerVisible}
                onClose={() => setViewerVisible(false)}
            />
        </ScreenLayout>
    );
}

const viewerStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.96)",
        justifyContent: "center",
    },
    page: {
        width: SCREEN_W,
        height: SCREEN_H,
        justifyContent: "center",
        alignItems: "center",
    },
    img: {
        width: SCREEN_W,
        height: SCREEN_H * 0.8,
    },
    closeBtn: {
        position: "absolute",
        top: 52,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
    },
    dots: {
        position: "absolute",
        bottom: 44,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.35)",
    },
    dotActive: {
        backgroundColor: "#fff",
        transform: [{ scale: 1.2 }],
    },
});

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xxxl * 2, paddingTop: spacing.lg },
    notFound: { textAlign: "center", marginTop: spacing.xxl, color: colors.textMuted },
    galleryImg: { width: SCREEN_W, height: IMG_H },
    dots: {
        position: "absolute",
        bottom: spacing.md,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.xs,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.30)",
    },
    dotActive: {
        backgroundColor: "#fff",
        transform: [{ scale: 1.3 }],
    },
    content: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    meta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    badge: {
        backgroundColor: `${colors.info}22`,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: `${colors.info}44`,
    },
    badgeTxt: { fontSize: 11, fontWeight: "700", color: colors.info },
    date: { color: colors.textMuted },
    title: { color: colors.text, lineHeight: 32 },
    divider: { height: 1, backgroundColor: colors.borderSubtle },
    body: { color: colors.textDim, lineHeight: 24 },
});
