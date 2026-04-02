import React from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
} from "react-native";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = TextInputProps & {
    label?: string;
    /** Подсказка под полем — переносится, в отличие от placeholder */
    hint?: string;
    error?: string;
};

export function Input({ label, hint, error, style, ...rest }: Props) {
    return (
        <View style={styles.wrap}>
            {!!label && (
                <Text style={[textStyles.label, styles.label]}>{label}</Text>
            )}
            <TextInput
                placeholderTextColor={colors.textDim}
                style={[
                    textStyles.body,
                    styles.input,
                    error ? styles.inputError : null,
                    style,
                ]}
                {...rest}
            />
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
    label: { color: colors.textMuted },
    hint: { color: colors.textDim },
    input: {
        backgroundColor: colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        color: colors.text,
    },
    inputError: { borderColor: colors.danger },
    error: { color: colors.danger },
});
