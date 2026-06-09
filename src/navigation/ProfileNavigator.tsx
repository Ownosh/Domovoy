import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { AppealHistoryScreen } from "../screens/profile/AppealHistoryScreen";
import { AppealDetailScreen } from "../screens/appeals/AppealDetailScreen";
import { ChangePasswordScreen } from "../screens/profile/ChangePasswordScreen";
import { ContactsScreen } from "../screens/profile/ContactsScreen";
import { DeleteAccountScreen } from "../screens/profile/DeleteAccountScreen";
import { EditProfileScreen } from "../screens/profile/EditProfileScreen";
import { NotificationSettingsScreen } from "../screens/profile/NotificationSettingsScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { PrivacyPolicyScreen } from "../screens/auth/PrivacyPolicyScreen";
import { VerificationScreen } from "../screens/profile/VerificationScreen";
import { ApartmentsScreen } from "../screens/profile/ApartmentsScreen";
import { AddApartmentScreen } from "../screens/profile/AddApartmentScreen";
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
                name="PrivacyPolicy"
                component={PrivacyPolicyScreen}
            />
            <Stack.Screen
                name="DeleteAccount"
                component={DeleteAccountScreen}
            />
            <Stack.Screen
                name="AppealHistory"
                component={AppealHistoryScreen}
            />
            <Stack.Screen
                name="AppealHistoryDetail"
                component={AppealDetailScreen as any}
            />
            <Stack.Screen
                name="NotificationSettings"
                component={NotificationSettingsScreen}
            />
            <Stack.Screen name="Contacts" component={ContactsScreen} />
            <Stack.Screen name="Apartments" component={ApartmentsScreen} />
            <Stack.Screen name="AddApartment" component={AddApartmentScreen} />
        </Stack.Navigator>
    );
}
