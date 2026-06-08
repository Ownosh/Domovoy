import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useApp } from "../context/AppContext";
import { colors } from "../theme";
import { AuthNavigator } from "./AuthNavigator";
import { CommunityNavigator } from "./CommunityNavigator";
import type { AuthenticatedRootParamList } from "./types";
import { MainTabs } from "./MainTabs";
import { SosQuickScreen } from "../screens/safety/SosQuickScreen";
import { NewsDetailScreen } from "../screens/home/NewsDetailScreen";

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

const Stack = createNativeStackNavigator<AuthenticatedRootParamList>();

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
            {isAuthenticated ? (
                <Stack.Navigator
                    id="AuthenticatedRoot"
                    screenOptions={{ headerShown: false }}
                >
                    <Stack.Screen name="Main" component={MainTabs} />
                    <Stack.Screen
                        name="Community"
                        component={CommunityNavigator}
                        options={{ presentation: "modal" }}
                    />
                    <Stack.Screen
                        name="Sos"
                        component={SosQuickScreen}
                        options={{ presentation: "modal" }}
                    />
                    <Stack.Screen
                        name="NewsDetail"
                        component={NewsDetailScreen}
                        options={{ presentation: "card" }}
                    />
                </Stack.Navigator>
            ) : (
                <AuthNavigator />
            )}
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
