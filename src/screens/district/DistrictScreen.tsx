import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DistrictMap } from "../../components/map/DistrictMap";
import { Card, ScreenLayout } from "../../components/ui";
import { districtPois } from "../../data/mockData";
import type { PoiCategory } from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

const filters: { id: PoiCategory | "all"; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "education", label: "Образование" },
    { id: "health", label: "Медицина" },
    { id: "shopping", label: "Торговля" },
    { id: "leisure", label: "Отдых" },
];

const catColors: Record<PoiCategory, string> = {
    education: "#6b9fd4",
    health: "#e05d8c",
    shopping: "#d4a853",
    leisure: "#3d9e7a",
};

export function DistrictScreen() {
    const [filter, setFilter] = useState<PoiCategory | "all">("all");
    const list = useMemo(
        () =>
            filter === "all"
                ? districtPois
                : districtPois.filter((p) => p.category === filter),
        [filter],
    );

    return (
        <ScreenLayout
            title="Район"
            subtitle="Справочник и карта объектов рядом с домом"
        >
            <View style={styles.filters}>
                {filters.map((f) => (
                    <Pressable
                        key={f.id}
                        onPress={() => setFilter(f.id)}
                        style={[
                            styles.filterChip,
                            filter === f.id && styles.filterChipOn,
                        ]}
                    >
                        <Text
                            style={[
                                textStyles.caption,
                                filter === f.id
                                    ? styles.filterOnText
                                    : styles.filterOffText,
                            ]}
                        >
                            {f.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <Card>
                <DistrictMap pois={list} />
            </Card>

            <Text style={[textStyles.label, styles.listTitle]}>Список</Text>
            {list.map((p) => (
                <Card key={p.id} style={styles.poiCard}>
                    <View
                        style={[
                            styles.dot,
                            { backgroundColor: catColors[p.category] },
                        ]}
                    />
                    <View style={styles.poiText}>
                        <Text style={[textStyles.subtitle, styles.poiName]}>
                            {p.name}
                        </Text>
                        <Text style={[textStyles.caption, styles.poiAddr]}>
                            {p.address}
                        </Text>
                    </View>
                </Card>
            ))}
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    filters: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    filterChipOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    filterOnText: { color: colors.primary },
    filterOffText: { color: colors.textMuted },
    listTitle: { color: colors.textMuted },
    poiCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
    },
    poiText: { flex: 1 },
    poiName: { color: colors.text },
    poiAddr: { color: colors.textMuted, marginTop: spacing.xs },
});
