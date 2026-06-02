import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { AppealsNavigator } from "./AppealsNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { SafetyNavigator } from "./SafetyNavigator";
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
                    title: "Сообщество",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="chatbox-ellipses-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="AboutHouse"
                component={HousePassportScreen}
                options={{
                    title: "О доме",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home-outline" size={size} color={color} />
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
                name="Safety"
                component={SafetyNavigator}
                options={{
                    title: "Безопасность и ЧС",
                    tabBarLabel: "Памятка",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="book-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileNavigator}
                options={{
                    title: "Профиль",
                    tabBarItemStyle: { display: "none" },
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
