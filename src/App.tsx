import {
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    useFonts,
} from "@expo-google-fonts/montserrat";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import YaMap from "react-native-yamap";
import { AppProvider } from "./context/AppContext";
import { RootNavigator } from "./navigation/RootNavigator";
import { colors } from "./theme";

const YANDEX_MAPKIT_API_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY ?? "";

export default function App() {
    useEffect(() => {
        if (Platform.OS === "android" && YANDEX_MAPKIT_API_KEY) {
            YaMap.init(YANDEX_MAPKIT_API_KEY);
        }
    }, []);

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
