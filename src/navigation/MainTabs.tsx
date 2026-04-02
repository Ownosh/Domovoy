import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { AppealsNavigator } from "./AppealsNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import type { MainTabParamList } from "./types";
import { DistrictScreen } from "../screens/district/DistrictScreen";
import { HomeScreen } from "../screens/home/HomeScreen";
import { HousePassportScreen } from "../screens/house/HousePassportScreen";
import { colors, spacing } from "../theme";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
    return (
        <Tab.Navigator
            id="MainTabs"
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textDim,
                tabBarLabelStyle: styles.label,
                tabBarItemStyle: styles.item,
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: "Лента",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="newspaper-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Appeals"
                component={AppealsNavigator}
                options={{
                    title: "Обращения",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="chatbox-ellipses-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="House"
                component={HousePassportScreen}
                options={{
                    title: "Дом",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="business-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="District"
                component={DistrictScreen}
                options={{
                    title: "Район",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="map-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileNavigator}
                options={{
                    title: "Профиль",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-circle-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: colors.bgElevated,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: Platform.OS === "ios" ? 88 : 64,
        paddingTop: spacing.sm,
        paddingBottom: Platform.OS === "ios" ? spacing.lg : spacing.sm,
    },
    label: { fontSize: 11, fontWeight: "600" },
    item: { paddingTop: 4 },
});
