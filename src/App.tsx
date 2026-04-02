import React from "react";
import { View, Text, StyleSheet } from "react-native";

const App = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Привет, Домовой!</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#191A1F"
    },
    text: {
        color: "white",
        fontSize: 24,
        textAlign: "center",
        fontWeight: "bold"
    }
});

export default App;