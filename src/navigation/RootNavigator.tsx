import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useApp } from "../context/AppContext";
import { colors } from "../theme";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabs } from "./MainTabs";

const navTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: colors.bg,
        card: colors.bgElevated,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
    },
};

export function RootNavigator() {
    const { hydrated, isAuthenticated } = useApp();

    if (!hydrated) {
        return (
            <View style={styles.boot}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer theme={navTheme}>
            {isAuthenticated ? <MainTabs /> : <AuthNavigator />}
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    boot: {
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
    },
});
