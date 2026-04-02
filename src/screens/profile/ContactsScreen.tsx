import type { ProfileScreenProps } from "../../navigation/types";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ScreenLayout } from "../../components/ui";
import { ukContacts } from "../../data/mockData";
import { colors, spacing, textStyles } from "../../theme";

type Props = ProfileScreenProps<"Contacts">;

export function ContactsScreen({ navigation }: Props) {
    const c = ukContacts;

    const openUrl = (url: string) => {
        Linking.openURL(url).catch(() => {});
    };

    return (
        <ScreenLayout
            title="Контакты УК"
            subtitle={c.companyName}
            onBack={() => navigation.goBack()}
        >
            <Card>
                <ContactRow
                    icon="mail-outline"
                    label="Email"
                    value={c.email}
                    onPress={() => openUrl(`mailto:${c.email}`)}
                />
                <View style={styles.divider} />
                <ContactRow
                    icon="call-outline"
                    label="Телефон"
                    value={c.phone}
                    onPress={() => openUrl(`tel:${c.phone.replace(/\s/g, "")}`)}
                />
                <View style={styles.divider} />
                <ContactRow
                    icon="globe-outline"
                    label="Сайт"
                    value={c.site.replace(/^https?:\/\//, "")}
                    onPress={() => openUrl(c.site)}
                />
                <View style={styles.divider} />
                <View style={styles.row}>
                    <Ionicons
                        name="time-outline"
                        size={22}
                        color={colors.textMuted}
                    />
                    <View style={styles.rowText}>
                        <Text style={[textStyles.caption, styles.label]}>
                            Режим работы
                        </Text>
                        <Text style={[textStyles.body, styles.value]}>
                            {c.hours}
                        </Text>
                    </View>
                </View>
            </Card>
        </ScreenLayout>
    );
}

function ContactRow({
    icon,
    label,
    value,
    onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Ionicons name={icon} size={22} color={colors.primary} />
            <View style={styles.rowText}>
                <Text style={[textStyles.caption, styles.label]}>{label}</Text>
                <Text style={[textStyles.body, styles.value]}>{value}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textDim} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
    },
    pressed: { opacity: 0.8 },
    rowText: { flex: 1 },
    label: { color: colors.textDim },
    value: { color: colors.text, marginTop: spacing.xs },
    divider: {
        height: 1,
        backgroundColor: colors.borderSubtle,
        marginVertical: spacing.sm,
    },
});
