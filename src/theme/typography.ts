import { TextStyle } from "react-native";

export const fontFamily = {
    regular: "Montserrat_400Regular",
    medium: "Montserrat_500Medium",
    semiBold: "Montserrat_600SemiBold",
    bold: "Montserrat_700Bold",
} as const;

export const textStyles = {
    hero: {
        fontFamily: fontFamily.bold,
        fontSize: 28,
        letterSpacing: -0.5,
    } satisfies TextStyle,
    title: {
        fontFamily: fontFamily.semiBold,
        fontSize: 20,
        letterSpacing: -0.3,
    } satisfies TextStyle,
    subtitle: {
        fontFamily: fontFamily.medium,
        fontSize: 16,
    } satisfies TextStyle,
    body: {
        fontFamily: fontFamily.regular,
        fontSize: 15,
        lineHeight: 22,
    } satisfies TextStyle,
    caption: {
        fontFamily: fontFamily.regular,
        fontSize: 13,
        lineHeight: 18,
    } satisfies TextStyle,
    label: {
        fontFamily: fontFamily.semiBold,
        fontSize: 12,
        letterSpacing: 0.4,
        textTransform: "uppercase" as const,
    } satisfies TextStyle,
};
