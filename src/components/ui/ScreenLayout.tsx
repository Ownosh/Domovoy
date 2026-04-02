import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, textStyles } from "../../theme";

type Props = {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    scroll?: boolean;
    contentStyle?: ViewStyle;
    rightAccessory?: React.ReactNode;
    onBack?: () => void;
};

export function ScreenLayout({
    title,
    subtitle,
    children,
    scroll = true,
    contentStyle,
    rightAccessory,
    onBack,
}: Props) {
    const body = (
        <View style={[styles.inner, contentStyle]}>{children}</View>
    );

    return (
        <LinearGradient
            colors={[colors.bg, "#0e151c", colors.bgElevated]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
        >
            <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
                {(title || subtitle || rightAccessory || onBack) && (
                    <View style={styles.header}>
                        {onBack ? (
                            <Pressable
                                onPress={onBack}
                                style={({ pressed }) => [
                                    styles.backBtn,
                                    pressed && styles.backPressed,
                                ]}
                                hitSlop={12}
                            >
                                <Ionicons
                                    name="chevron-back"
                                    size={28}
                                    color={colors.text}
                                />
                            </Pressable>
                        ) : null}
                        <View style={styles.headerText}>
                            {!!title && (
                                <Text style={[textStyles.hero, styles.title]}>
                                    {title}
                                </Text>
                            )}
                            {!!subtitle && (
                                <Text
                                    style={[textStyles.caption, styles.subtitle]}
                                >
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                        {rightAccessory}
                    </View>
                )}
                {scroll ? (
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {body}
                    </ScrollView>
                ) : (
                    body
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xxxl },
    header: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        gap: spacing.sm,
    },
    backBtn: {
        marginLeft: -spacing.sm,
        marginTop: -spacing.xs,
    },
    backPressed: { opacity: 0.6 },
    headerText: { flex: 1, paddingRight: spacing.md },
    title: { color: colors.text },
    subtitle: { color: colors.textMuted, marginTop: spacing.xs },
    inner: {
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
    },
});
