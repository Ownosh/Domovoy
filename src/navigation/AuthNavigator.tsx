import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { PrivacyPolicyScreen } from "../screens/auth/PrivacyPolicyScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
    return (
        <Stack.Navigator
            id="AuthStack"
            initialRouteName="Login"
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        </Stack.Navigator>
    );
}
