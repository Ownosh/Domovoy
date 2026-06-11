import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppealsNavigator } from "./AppealsNavigator";
import { ProfileNavigator } from "./ProfileNavigator";
import { SafetyNavigator } from "./SafetyNavigator";
import type { MainTabParamList } from "./types";
import { DistrictScreen } from "../screens/district/DistrictScreen";
import { HomeScreen } from "../screens/home/HomeScreen";
import { HousePassportScreen } from "../screens/house/HousePassportScreen";
import { useApp, isVerifiedResident } from "../context/AppContext";
import { colors, spacing } from "../theme";

const Tab = createBottomTabNavigator<MainTabParamList>();

const HIDDEN: object = { display: "none" as const };

export function MainTabs() {
    const { verification } = useApp();
    const verified = isVerifiedResident(verification);
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            id="MainTabs"
            screenOptions={{
                headerShown: false,
                tabBarStyle: [
                    styles.tabBar,
                    {
                        height: 64 + insets.bottom,
                        paddingBottom: spacing.sm + insets.bottom,
                    },
                ],
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
                    tabBarItemStyle: verified ? styles.item : HIDDEN,
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
                    tabBarItemStyle: verified ? styles.item : HIDDEN,
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
        paddingTop: spacing.sm,
    },
    label: { fontSize: 11, fontWeight: "600" },
    item: { paddingTop: 4 },
});
