import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TextStyle,
    View,
} from "react-native";
import { colors, fontFamily, radius, spacing, textStyles } from "../../theme";

type Props = TextInputProps & {
    label?: string;
    labelStyle?: TextStyle;
    hint?: string;
    error?: string;
    showPasswordToggle?: boolean;
};

export function Input({
    label,
    labelStyle,
    hint,
    error,
    style,
    showPasswordToggle,
    secureTextEntry,
    ...rest
}: Props) {
    const [isSecure, setIsSecure] = useState(secureTextEntry ?? false);
    const inputRef = useRef<TextInput>(null);

    const handleToggle = () => {
        const len = String(rest.value ?? "").length;
        setIsSecure((v) => !v);
        // iOS fix: after toggling secureTextEntry, iOS selects all text —
        // reset cursor to end so backspace only deletes the last character
        setTimeout(() => {
            inputRef.current?.setNativeProps({
                selection: { start: len, end: len },
            });
        }, 10);
    };

    return (
        <View style={styles.wrap}>
            {!!label && (
                <Text style={[textStyles.label, styles.label, labelStyle]}>{label}</Text>
            )}
            <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
                <TextInput
                    ref={inputRef}
                    placeholderTextColor={colors.textDim}
                    underlineColorAndroid="transparent"
                    autoCorrect={false}
                    spellCheck={false}
                    secureTextEntry={isSecure}
                    style={[styles.input, style]}
                    {...rest}
                />
                {showPasswordToggle && (
                    <Pressable
                        onPress={handleToggle}
                        style={styles.eyeBtn}
                        hitSlop={8}
                    >
                        <Ionicons
                            name={isSecure ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color={colors.textDim}
                        />
                    </Pressable>
                )}
            </View>
            {!!hint && (
                <Text style={[textStyles.caption, styles.hint]}>{hint}</Text>
            )}
            {!!error && (
                <Text style={[textStyles.caption, styles.error]}>{error}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: spacing.sm },
    label: { color: colors.text },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        overflow: "hidden",
        backgroundColor: colors.bgElevated,
    },
    inputWrapperError: {
        borderColor: colors.danger,
    },
    input: {
        flex: 1,
        fontFamily: fontFamily.regular,
        fontSize: 15,
        // lineHeight intentionally omitted: prevents descender clipping on iOS with Montserrat
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        color: colors.text,
    },
    eyeBtn: {
        paddingHorizontal: spacing.md,
        alignSelf: "stretch",
        justifyContent: "center",
    },
    hint: { color: colors.textDim },
    error: { color: colors.danger },
});
