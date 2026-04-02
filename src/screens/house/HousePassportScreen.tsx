import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, ScreenLayout } from "../../components/ui";
import { housePassport } from "../../data/mockData";
import { colors, radius, spacing, textStyles } from "../../theme";

export function HousePassportScreen() {
    const h = housePassport;

    return (
        <ScreenLayout
            title="Паспорт дома"
            subtitle="Технические данные и материалы"
        >
            <Card>
                <Text style={[textStyles.subtitle, styles.addr]}>{h.address}</Text>
                <View style={styles.stats}>
                    <View style={styles.stat}>
                        <Text style={[textStyles.caption, styles.statLabel]}>
                            Год ввода
                        </Text>
                        <Text style={[textStyles.title, styles.statVal]}>
                            {h.yearBuilt}
                        </Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[textStyles.caption, styles.statLabel]}>
                            Подъезды
                        </Text>
                        <Text style={[textStyles.title, styles.statVal]}>
                            {h.entrances}
                        </Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[textStyles.caption, styles.statLabel]}>
                            Квартиры
                        </Text>
                        <Text style={[textStyles.title, styles.statVal]}>
                            {h.apartments}
                        </Text>
                    </View>
                </View>
            </Card>

            <Text style={[textStyles.label, styles.section]}>Фотографии</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photos}
            >
                {h.photoUrls.map((uri, i) => (
                    <Image
                        key={uri + i}
                        source={{ uri }}
                        style={styles.photo}
                    />
                ))}
            </ScrollView>

            <Text style={[textStyles.label, styles.section]}>
                Характеристики
            </Text>
            <Card padded={false}>
                {h.specs.map((row, idx) => (
                    <View
                        key={row.label}
                        style={[
                            styles.specRow,
                            idx < h.specs.length - 1 && styles.specBorder,
                        ]}
                    >
                        <Text style={[textStyles.caption, styles.specLabel]}>
                            {row.label}
                        </Text>
                        <Text style={[textStyles.body, styles.specVal]}>
                            {row.value}
                        </Text>
                    </View>
                ))}
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    addr: { color: colors.text },
    stats: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    stat: {
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        padding: spacing.md,
    },
    statLabel: { color: colors.textDim },
    statVal: { color: colors.primary, marginTop: spacing.xs },
    section: { color: colors.textMuted, marginTop: spacing.sm },
    photos: { gap: spacing.md, paddingVertical: spacing.sm },
    photo: {
        width: 220,
        height: 140,
        borderRadius: radius.lg,
        backgroundColor: colors.border,
    },
    specRow: { padding: spacing.lg },
    specBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
    specLabel: { color: colors.textMuted },
    specVal: { color: colors.text, marginTop: spacing.xs },
});
