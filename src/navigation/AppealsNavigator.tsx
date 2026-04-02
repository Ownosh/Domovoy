import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { AppealsListScreen } from "../screens/appeals/AppealsListScreen";
import { AppealDetailScreen } from "../screens/appeals/AppealDetailScreen";
import { NewAppealScreen } from "../screens/appeals/NewAppealScreen";
import type { AppealsStackParamList } from "./types";

const Stack = createNativeStackNavigator<AppealsStackParamList>();

export function AppealsNavigator() {
    return (
        <Stack.Navigator
            id="AppealsStack"
            initialRouteName="AppealsList"
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="AppealsList" component={AppealsListScreen} />
            <Stack.Screen name="AppealNew" component={NewAppealScreen} />
            <Stack.Screen name="AppealDetail" component={AppealDetailScreen} />
        </Stack.Navigator>
    );
}
