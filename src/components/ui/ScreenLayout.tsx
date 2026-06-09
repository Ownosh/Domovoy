import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, textStyles } from "../../theme";
import { ApartmentSwitcher } from "./ApartmentSwitcher";

type Props = {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    scroll?: boolean;
    contentStyle?: ViewStyle;
    rightAccessory?: React.ReactNode;
    onBack?: () => void;
    centerHeader?: boolean;
    onRefresh?: () => void;
    refreshing?: boolean;
    /** Показывать переключатель квартир справа в шапке (по умолч. true для экранов без кнопки назад) */
    showApartmentSwitcher?: boolean;
};

export function ScreenLayout({
    title,
    subtitle,
    children,
    scroll = true,
    contentStyle,
    rightAccessory,
    onBack,
    centerHeader,
    onRefresh,
    refreshing = false,
    showApartmentSwitcher,
}: Props) {
    // Показываем переключатель по умолчанию на верхних экранах (без кнопки назад),
    // если пользователь явно не передал rightAccessory и не отключил его
    const showSwitcher = showApartmentSwitcher ?? (!onBack && !rightAccessory);
    const body = (
        <View
            style={[
                styles.inner,
                !scroll && styles.innerNoScroll,
                contentStyle,
            ]}
        >
            {children}
        </View>
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
                    <View style={[styles.header, onBack && styles.headerWithBack]}>
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
                        <View
                            style={[
                                styles.headerText,
                                onBack && styles.headerTextWithBack,
                                centerHeader && styles.headerTextCentered,
                            ]}
                        >
                            {!!title && (
                                <Text
                                    style={[
                                        textStyles.hero,
                                        styles.title,
                                        (onBack || centerHeader) && styles.titleWithBack,
                                    ]}
                                >
                                    {title}
                                </Text>
                            )}
                            {!!subtitle && (
                                <Text
                                    style={[
                                        textStyles.caption,
                                        styles.subtitle,
                                        (onBack || centerHeader) && styles.subtitleWithBack,
                                    ]}
                                >
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                        {rightAccessory ? (
                            <View style={styles.rightAccessory}>{rightAccessory}</View>
                        ) : showSwitcher ? (
                            <View style={styles.rightAccessory}><ApartmentSwitcher /></View>
                        ) : null}
                    </View>
                )}
                {scroll ? (
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            onRefresh ? (
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                            ) : undefined
                        }
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
    scrollContent: {
        paddingBottom: spacing.xxxl * 2,
        flexGrow: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        gap: spacing.sm,
    },
    headerWithBack: {
        justifyContent: "center",
        alignItems: "center",
        minHeight: 44,
    },
    backBtn: {
        position: "absolute",
        left: spacing.lg - spacing.sm,
        top: spacing.sm,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    backPressed: { opacity: 0.6 },
    headerText: { flex: 1, paddingRight: spacing.md },
    headerTextWithBack: {
        flex: 0,
        paddingLeft: spacing.xl,
        paddingRight: spacing.xl,
        alignItems: "center",
    },
    headerTextCentered: {
        alignItems: "center",
    },
    rightAccessory: { marginLeft: "auto" },
    title: { color: colors.text },
    titleWithBack: { textAlign: "center" },
    subtitle: { color: colors.textMuted, marginTop: spacing.xs },
    subtitleWithBack: { textAlign: "center" },
    inner: {
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
    },
    innerNoScroll: { flex: 1 },
});
