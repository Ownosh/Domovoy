import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { AppealHistoryScreen } from "../screens/profile/AppealHistoryScreen";
import { ChangePasswordScreen } from "../screens/profile/ChangePasswordScreen";
import { ContactsScreen } from "../screens/profile/ContactsScreen";
import { DeleteAccountScreen } from "../screens/profile/DeleteAccountScreen";
import { EditProfileScreen } from "../screens/profile/EditProfileScreen";
import { NotificationSettingsScreen } from "../screens/profile/NotificationSettingsScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { VerificationScreen } from "../screens/profile/VerificationScreen";
import type { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
    return (
        <Stack.Navigator
            id="ProfileStack"
            initialRouteName="ProfileMain"
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="ProfileMain" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
            />
            <Stack.Screen name="Verification" component={VerificationScreen} />
            <Stack.Screen
                name="DeleteAccount"
                component={DeleteAccountScreen}
            />
            <Stack.Screen
                name="AppealHistory"
                component={AppealHistoryScreen}
            />
            <Stack.Screen
                name="NotificationSettings"
                component={NotificationSettingsScreen}
            />
            <Stack.Screen name="Contacts" component={ContactsScreen} />
        </Stack.Navigator>
    );
}
