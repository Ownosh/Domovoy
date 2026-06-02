import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import type { SafetyStackParamList } from "./types";
import {
    EmergencyGuideDetailScreen,
    EmergencyGuideScreen,
    EmergencyPhonesScreen,
    RightsResidentsScreen,
    RightsUkScreen,
    SafetyHubScreen,
} from "../screens/safety";

const Stack = createNativeStackNavigator<SafetyStackParamList>();

export function SafetyNavigator() {
    return (
        <Stack.Navigator
            id="SafetyStack"
            initialRouteName="SafetyHub"
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="SafetyHub" component={SafetyHubScreen} />
            <Stack.Screen name="EmergencyPhones" component={EmergencyPhonesScreen} />
            <Stack.Screen name="EmergencyGuide" component={EmergencyGuideScreen} />
            <Stack.Screen
                name="EmergencyGuideDetail"
                component={EmergencyGuideDetailScreen}
            />
            <Stack.Screen name="RightsResidents" component={RightsResidentsScreen} />
            <Stack.Screen name="RightsUk" component={RightsUkScreen} />
        </Stack.Navigator>
    );
}
