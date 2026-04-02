import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { districtMapCenter } from "../../data/mockData";
import { textStyles } from "../../theme";
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

    const region = {
        latitude: districtMapCenter.lat,
        longitude: districtMapCenter.lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
    };

    return (
        <View style={styles.wrap}>
            <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={region}
                showsUserLocation={false}
            >
                {pois.map((p) => (
                    <Marker
                        key={p.id}
                        coordinate={{ latitude: p.lat, longitude: p.lng }}
                        title={p.name}
                        description={p.address}
                        onPress={() => setActiveId(p.id)}
                    >
                        <View
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: categoryColors[p.category],
                                },
                            ]}
                        />
                    </Marker>
                ))}
            </MapView>
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
