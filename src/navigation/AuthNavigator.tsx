import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useApp } from "../context/AppContext";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
    const { hasAccount } = useApp();

    return (
        <Stack.Navigator
            id="AuthStack"
            key={hasAccount ? "login-first" : "register-first"}
            initialRouteName={hasAccount ? "Login" : "Register"}
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    );
}
