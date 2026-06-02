import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { AppealsListScreen } from "../screens/appeals/AppealsListScreen";
import { AppealDetailScreen } from "../screens/appeals/AppealDetailScreen";
import { NewAppealScreen } from "../screens/appeals/NewAppealScreen";
import { NeighborAdDetailScreen } from "../screens/community/NeighborAdDetailScreen";
import { NeighborAdNewScreen } from "../screens/community/NeighborAdNewScreen";
import { VoteCreateInfoScreen } from "../screens/community/VoteCreateInfoScreen";
import { VoteDetailScreen } from "../screens/community/VoteDetailScreen";
import { VoteNewScreen } from "../screens/community/VoteNewScreen";
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
            <Stack.Screen name="NeighborAdNew" component={NeighborAdNewScreen} />
            <Stack.Screen name="NeighborAdDetail" component={NeighborAdDetailScreen} />
            <Stack.Screen name="VoteCreateInfo" component={VoteCreateInfoScreen} />
            <Stack.Screen name="VoteNew" component={VoteNewScreen} />
            <Stack.Screen name="VoteDetail" component={VoteDetailScreen} />
        </Stack.Navigator>
    );
}
