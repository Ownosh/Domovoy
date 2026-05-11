import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EmergencyCallBlock } from "../../components/safety/EmergencyCallBlock";
import { ScreenLayout } from "../../components/ui";
import { BASE_EMERGENCY_CONTACTS } from "../../data/emergencyDefaults";
import { ukEmergencyExtraContacts } from "../../data/mockData";
import type { SafetyStackParamList } from "../../navigation/types";
import type { EmergencyContactLine } from "../../types";
import {
    groupEmergencyLinesForDisplay,
    mergeEmergencyLines,
    readEmergencyLinesCache,
    writeEmergencyLinesCache,
} from "../../utils/emergencyCache";
import { colors, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<SafetyStackParamList, "EmergencyPhones">;

export function EmergencyPhonesScreen({ navigation }: Props) {
    const [lines, setLines] = useState<EmergencyContactLine[]>(BASE_EMERGENCY_CONTACTS);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const merged = mergeEmergencyLines(
                BASE_EMERGENCY_CONTACTS,
                ukEmergencyExtraContacts,
            );
            const cached = await readEmergencyLinesCache();
            if (cancelled) return;
            if (cached && cached.length > 0) {
                setLines(
                    mergeEmergencyLines(cached, ukEmergencyExtraContacts),
                );
            } else {
                setLines(merged);
            }
            await writeEmergencyLinesCache(merged);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <ScreenLayout
            title="Аварийные номера"
            subtitle="Нажмите на кнопку для вызова службы"
            onBack={() => navigation.goBack()}
        >
            <View style={styles.sections}>
                {groupEmergencyLinesForDisplay(lines).map((section) => (
                    <View key={section.title} style={styles.section}>
                        <Text style={[textStyles.label, styles.sectionTitle]}>
                            {section.title}
                        </Text>
                        <View style={styles.list}>
                            {section.lines.map((item) => (
                                <EmergencyCallBlock key={item.id} line={item} />
                            ))}
                        </View>
                    </View>
                ))}
            </View>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    hint: { color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 18 },
    sections: { gap: spacing.xl },
    section: { gap: spacing.sm },
    sectionTitle: { color: colors.textMuted, marginBottom: spacing.xs },
    list: { gap: spacing.md },
});
