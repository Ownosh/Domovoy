import {
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    useFonts,
} from "@expo-google-fonts/montserrat";
import YaMap from "react-native-yamap";
import React from "react";

YaMap.init("380e6e80-b316-4896-9572-fd01f0e87a80");
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "./context/AppContext";
import { RootNavigator } from "./navigation/RootNavigator";
import { colors } from "./theme";

export default function App() {
    const [fontsLoaded] = useFonts({
        Montserrat_400Regular,
        Montserrat_500Medium,
        Montserrat_600SemiBold,
        Montserrat_700Bold,
    });

    if (!fontsLoaded) {
        return (
            <View style={styles.boot}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <AppProvider>
                <StatusBar style="light" />
                <RootNavigator />
            </AppProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    boot: {
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
    },
});
