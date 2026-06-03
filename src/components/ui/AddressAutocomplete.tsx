import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { searchBuildings, type BuildingSuggestion } from "../../api/buildings";
import { colors, fontFamily, radius, spacing, textStyles } from "../../theme";

type Props = {
    label?: string;
    hint?: string;
    error?: string;
    value: string;
    onChangeText: (text: string) => void;
    onSelectSuggestion?: (item: BuildingSuggestion) => void;
    placeholder?: string;
};

export function AddressAutocomplete({
    label,
    hint,
    error,
    value,
    onChangeText,
    onSelectSuggestion,
    placeholder,
}: Props) {
    const [suggestions, setSuggestions] = useState<BuildingSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeRef = useRef(true);
    // true только когда пользователь сам начал вводить (не при инициализации)
    const dirtyRef = useRef(false);

    useEffect(() => {
        activeRef.current = true;
        return () => {
            activeRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        // Не ищем пока пользователь не начал редактировать поле
        if (!dirtyRef.current) return;

        const trimmed = value.trim();

        if (trimmed.length < 1) {
            setSuggestions([]);
            setNotFound(false);
            setLoading(false);
            return;
        }

        setLoading(true);
        setNotFound(false);

        debounceRef.current = setTimeout(async () => {
            const results = await searchBuildings(trimmed);
            if (!activeRef.current) return;
            setLoading(false);
            setSuggestions(results);
            setNotFound(results.length === 0 && trimmed.length >= 2);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [value]);

    const handleChangeText = (text: string) => {
        dirtyRef.current = true;
        onChangeText(text);
    };

    const handleSelect = (item: BuildingSuggestion) => {
        dirtyRef.current = false;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setLoading(false);
        setSuggestions([]);
        setNotFound(false);
        onChangeText(item.short_name);
        onSelectSuggestion?.(item);
    };

    const showDropdown = suggestions.length > 0;

    return (
        <View style={styles.container}>
            {!!label && (
                <Text style={[textStyles.label, styles.label]}>{label}</Text>
            )}

            <View style={styles.inputWrap}>
                <TextInput
                    style={[
                        styles.input,
                        !!error && styles.inputError,
                        showDropdown && styles.inputOpen,
                    ]}
                    value={value}
                    onChangeText={handleChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textDim}
                    autoCorrect={false}
                    autoCapitalize="words"
                />
                {loading && (
                    <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.spinner}
                    />
                )}
            </View>

            {showDropdown && (
                <View style={styles.dropdown}>
                    {suggestions.map((item, i) => (
                        <Pressable
                            key={item.building_key}
                            onPress={() => handleSelect(item)}
                            style={({ pressed }) => [
                                styles.row,
                                i < suggestions.length - 1 && styles.rowDivider,
                                pressed && styles.rowPressed,
                            ]}
                        >
                            <Text
                                style={[textStyles.body, styles.rowTitle]}
                                numberOfLines={1}
                            >
                                {item.short_name}
                            </Text>
                            {item.address !== item.short_name && (
                                <Text
                                    style={[textStyles.caption, styles.rowAddr]}
                                    numberOfLines={1}
                                >
                                    {item.address}
                                </Text>
                            )}
                        </Pressable>
                    ))}
                </View>
            )}

            {notFound && !loading && (
                <Text style={[textStyles.caption, styles.notFound]}>
                    Адрес не найден — можно ввести вручную
                </Text>
            )}

            {!!hint && !showDropdown && !notFound && (
                <Text style={[textStyles.caption, styles.hint]}>{hint}</Text>
            )}
            {!!error && (
                <Text style={[textStyles.caption, styles.errorText]}>{error}</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.sm },
    label: { color: colors.textMuted },
    inputWrap: {
        flexDirection: "row",
        alignItems: "center",
    },
    input: {
        flex: 1,
        fontFamily: fontFamily.regular,
        fontSize: 15,
        backgroundColor: colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        color: colors.text,
    },
    inputOpen: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottomColor: colors.borderSubtle,
    },
    inputError: { borderColor: colors.danger },
    spinner: { position: "absolute", right: spacing.md },
    dropdown: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: colors.border,
        borderBottomLeftRadius: radius.md,
        borderBottomRightRadius: radius.md,
        overflow: "hidden",
    },
    row: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    rowDivider: {
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    rowPressed: { backgroundColor: colors.surfaceHover },
    rowTitle: { color: colors.text },
    rowAddr: { color: colors.textMuted, marginTop: 2 },
    hint: { color: colors.textDim },
    notFound: { color: colors.textDim },
    errorText: { color: colors.danger },
});
