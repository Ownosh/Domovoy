import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, textStyles } from "../../theme";
import {
    categoryColors,
    categoryLabels,
    districtMapStyles as styles,
    type DistrictMapProps,
} from "./districtMapConstants";

export function DistrictMap({ pois }: DistrictMapProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const active = useMemo(
        () => pois.find((p) => p.id === activeId) ?? null,
        [pois, activeId],
    );

    const { width } = Dimensions.get("window");
    const mapW = Math.min(width - spacing.lg * 2, 560);
    const mapH = 280;

    const bounds = useMemo(() => {
        let minLat = Infinity,
            maxLat = -Infinity,
            minLng = Infinity,
            maxLng = -Infinity;
        pois.forEach((p) => {
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);
            minLng = Math.min(minLng, p.lng);
            maxLng = Math.max(maxLng, p.lng);
        });
        const pad = 0.002;
        return {
            minLat: minLat - pad,
            maxLat: maxLat + pad,
            minLng: minLng - pad,
            maxLng: maxLng + pad,
        };
    }, [pois]);

    const project = (lat: number, lng: number) => {
        const x =
            ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * mapW;
        const y =
            ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * mapH;
        return { x, y };
    };

    return (
        <View style={styles.wrap}>
            <View style={[styles.webMap, { width: mapW, height: mapH }]}>
                <View style={styles.webGrid} />
                {pois.map((p) => {
                    const { x, y } = project(p.lat, p.lng);
                    const selected = active?.id === p.id;
                    return (
                        <Pressable
                            key={p.id}
                            onPress={() => setActiveId(p.id)}
                            style={[
                                styles.webPin,
                                {
                                    left: x - 10,
                                    top: y - 10,
                                    backgroundColor: categoryColors[p.category],
                                    borderColor: selected
                                        ? colors.text
                                        : "transparent",
                                    borderWidth: selected ? 2 : 0,
                                },
                            ]}
                        />
                    );
                })}
            </View>
            <Text style={[textStyles.caption, styles.webHint]}>
                В веб-версии карта упрощена. В мобильном приложении отображается
                интерактивная карта на базе картографического движка.
            </Text>
            {active && (
                <View style={styles.callout}>
                    <Text style={[textStyles.subtitle, styles.callTitle]}>
                        {active.name}
                    </Text>
                    <Text style={[textStyles.caption, styles.callMeta]}>
                        {categoryLabels[active.category]} · {active.address}
                    </Text>
                </View>
            )}
        </View>
    );
}
