import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import type { CommunityStackParamList } from "./types";
import { NeighborAdDetailScreen } from "../screens/community/NeighborAdDetailScreen";
import { NeighborAdNewScreen } from "../screens/community/NeighborAdNewScreen";
import { VoteCreateInfoScreen } from "../screens/community/VoteCreateInfoScreen";
import { VoteDetailScreen } from "../screens/community/VoteDetailScreen";
import { VoteNewScreen } from "../screens/community/VoteNewScreen";
import { AppealDetailScreen } from "../screens/appeals/AppealDetailScreen";
import { NewAppealScreen } from "../screens/appeals/NewAppealScreen";

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export function CommunityNavigator() {
    return (
        <Stack.Navigator
            id="CommunityStack"
            initialRouteName="NeighborAdNew"
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="NeighborAdNew" component={NeighborAdNewScreen} />
            <Stack.Screen name="NeighborAdDetail" component={NeighborAdDetailScreen} />
            <Stack.Screen name="VoteDetail" component={VoteDetailScreen} />
            <Stack.Screen name="VoteCreateInfo" component={VoteCreateInfoScreen} />
            <Stack.Screen name="VoteNew" component={VoteNewScreen} />
            <Stack.Screen name="AppealDetail" component={AppealDetailScreen as any} />
            <Stack.Screen name="AppealNew" component={NewAppealScreen as any} />
        </Stack.Navigator>
    );
}
