import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenLayout } from "../../components/ui";
import { ukContacts } from "../../data/mockData";
import type { AuthenticatedRootParamList } from "../../navigation/types";
import { confirmThenDial } from "../../utils/dialPhone";
import { colors, radius, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<AuthenticatedRootParamList, "Sos">;

export function SosQuickScreen({ navigation }: Props) {
    const rows = useMemo(() => {
        const pl = ukContacts.phone.replace(/\D/g, "") || "84951234567";
        return [
            { key: "112", title: "112 — спасатели", phone: "112" as string },
            { key: "gas", title: "Газ", phone: "104", hint: "Аварийная газовая (регион)" },
            {
                key: "plumb",
                title: "Аварийная сантехника",
                phone: pl,
                hint: "Линия УК (демо)",
            },
        ] as const;
    }, []);

    return (
        <ScreenLayout title="SOS" subtitle="Только при реальной угрозе" scroll={false}>
            <Text style={[textStyles.caption, styles.warn]}>
                Одно подтверждение перед звонком — защита от случайного нажатия.
            </Text>
            <View style={styles.list}>
                {rows.map((row) => (
                    <Pressable
                        key={row.key}
                        onPress={() => confirmThenDial(row.title, row.phone)}
                        style={({ pressed }) => [
                            styles.bigBtn,
                            pressed && styles.bigBtnPressed,
                        ]}
                    >
                        <Text style={[textStyles.title, styles.bigTitle]}>{row.title}</Text>
                        {"hint" in row && row.hint ? (
                            <Text style={[textStyles.caption, styles.bigHint]}>{row.hint}</Text>
                        ) : null}
                    </Pressable>
                ))}
            </View>
            <Pressable onPress={() => navigation.goBack()} style={styles.close}>
                <Text style={[textStyles.body, styles.closeTxt]}>Закрыть</Text>
            </Pressable>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    warn: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 18 },
    list: { gap: spacing.lg, flex: 1 },
    bigBtn: {
        backgroundColor: colors.danger,
        borderRadius: radius.lg,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 88,
    },
    bigBtnPressed: { opacity: 0.92 },
    bigTitle: { color: colors.bg, textAlign: "center" },
    bigHint: { color: colors.bg, opacity: 0.85, marginTop: spacing.sm, textAlign: "center" },
    close: { marginTop: spacing.xl, alignItems: "center", padding: spacing.md },
    closeTxt: { color: colors.primary, fontWeight: "600" },
});
