import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import React, {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useMemo,
    useState,
} from "react";
import {
    Dimensions,
    Image,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { Button } from "../ui/Button";
import { colors, spacing, textStyles } from "../../theme";
import type { DistrictPoi, DistrictSearchHit } from "../../types";
import type { ExternalNavigatorApp } from "../../utils/openNavigatorRoute";
import { openRouteInExternalNavigator } from "../../utils/openNavigatorRoute";
import {
    districtMapStyles as styles,
    districtPoiColor,
    districtPoiLayerIcon,
    districtPoiLayerLabel,
    type DistrictMapProps,
} from "./districtMapConstants";

export type DistrictMapHandle = {
    showPoiDetail: (poi: DistrictPoi) => void;
    showSearchDetail: (hit: DistrictSearchHit) => void;
};

type DetailPanel =
    | { kind: "poi"; poi: DistrictPoi }
    | { kind: "search"; hit: DistrictSearchHit };

export const DistrictMap = forwardRef<DistrictMapHandle, DistrictMapProps>(
    function DistrictMap(
        { pois, schematicWidth, mapFocus, searchHit }: DistrictMapProps,
        ref,
    ) {
        const [panel, setPanel] = useState<DetailPanel | null>(null);
        const [navPickerOpen, setNavPickerOpen] = useState(false);

        useImperativeHandle(ref, () => ({
            showPoiDetail: (poi: DistrictPoi) => {
                setNavPickerOpen(false);
                setPanel({ kind: "poi", poi });
            },
            showSearchDetail: (hit: DistrictSearchHit) => {
                setNavPickerOpen(false);
                setPanel({ kind: "search", hit });
            },
        }));

        const { width } = Dimensions.get("window");
        const railAllowance = 104;
        const mapW =
            schematicWidth ??
            Math.max(200, Math.min(width - spacing.lg * 2 - railAllowance, 520));
        const mapH = 280;

        const bounds = useMemo(() => {
            const pts: { lat: number; lng: number }[] = pois.map((p) => ({
                lat: p.lat,
                lng: p.lng,
            }));
            if (searchHit) {
                pts.push({ lat: searchHit.lat, lng: searchHit.lng });
            }
            if (mapFocus) {
                pts.push({
                    lat: mapFocus.latitude,
                    lng: mapFocus.longitude,
                });
            }
            if (pts.length === 0) {
                return {
                    minLat: 58.58,
                    maxLat: 58.59,
                    minLng: 49.65,
                    maxLng: 49.67,
                };
            }
            let minLat = Infinity,
                maxLat = -Infinity,
                minLng = Infinity,
                maxLng = -Infinity;
            pts.forEach((p) => {
                minLat = Math.min(minLat, p.lat);
                maxLat = Math.max(maxLat, p.lat);
                minLng = Math.min(minLng, p.lng);
                maxLng = Math.max(maxLng, p.lng);
            });
            const pad = 0.004;
            return {
                minLat: minLat - pad,
                maxLat: maxLat + pad,
                minLng: minLng - pad,
                maxLng: maxLng + pad,
            };
        }, [pois, searchHit, mapFocus]);

        const project = (lat: number, lng: number) => {
            const x =
                ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * mapW;
            const y =
                ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * mapH;
            return { x, y };
        };

        const openNavigator = useCallback(
            (app: ExternalNavigatorApp, lat: number, lng: number) => {
                openRouteInExternalNavigator(
                    app,
                    { lat, lng },
                    undefined,
                );
                setNavPickerOpen(false);
                setPanel(null);
            },
            [],
        );

        const navLatLng = (d: DetailPanel) =>
            d.kind === "poi"
                ? { lat: d.poi.lat, lng: d.poi.lng }
                : { lat: d.hit.lat, lng: d.hit.lng };

        const detailVisible = panel !== null && !navPickerOpen;
        const navVisible = navPickerOpen && panel !== null;

        return (
            <View style={styles.wrap}>
                <View style={[styles.webMap, { width: mapW, height: mapH }]}>
                    <View style={styles.webGrid} />
                    {pois.map((p) => {
                        const { x, y } = project(p.lat, p.lng);
                        const selected =
                            panel?.kind === "poi" && panel.poi.id === p.id;
                        return (
                            <Pressable
                                key={p.id}
                                onPress={() => setPanel({ kind: "poi", poi: p })}
                                style={[
                                    styles.webPin,
                                    {
                                        left: x - 18,
                                        top: y - 18,
                                        backgroundColor: districtPoiColor(p),
                                        borderColor: selected
                                            ? colors.text
                                            : colors.bg,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name={districtPoiLayerIcon(p)}
                                    size={18}
                                    color="#fff"
                                />
                            </Pressable>
                        );
                    })}
                    {searchHit ? (
                        (() => {
                            const { x, y } = project(
                                searchHit.lat,
                                searchHit.lng,
                            );
                            const selected =
                                panel?.kind === "search" &&
                                panel.hit.id === searchHit.id;
                            return (
                                <Pressable
                                    key={`s-${searchHit.id}`}
                                    onPress={() =>
                                        setPanel({ kind: "search", hit: searchHit })
                                    }
                                    style={[
                                        styles.webPin,
                                        {
                                            left: x - 18,
                                            top: y - 18,
                                            backgroundColor: colors.warning,
                                            borderColor: selected
                                                ? colors.text
                                                : colors.bg,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="location"
                                        size={20}
                                        color={colors.bg}
                                    />
                                </Pressable>
                            );
                        })()
                    ) : null}
                </View>
                <Text style={[textStyles.caption, styles.webHint]}>
                    Схема по всему городу; оранжевая метка — результат поиска адреса.
                    Нажмите метку, затем «Проложить путь».
                </Text>

                <Modal
                    visible={detailVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setPanel(null)}
                >
                    <Pressable
                        style={styles.modalRoot}
                        onPress={() => setPanel(null)}
                    >
                        <Pressable
                            style={styles.modalCard}
                            onPress={(e) => e.stopPropagation()}
                        >
                            {panel?.kind === "poi" ? (
                                <>
                                    <View style={styles.modalHeader}>
                                        <View style={{ flex: 1, gap: 4 }}>
                                            <Text
                                                style={[
                                                    textStyles.subtitle,
                                                    styles.callTitle,
                                                ]}
                                            >
                                                {panel.poi.name}
                                            </Text>
                                            <Text
                                                style={[
                                                    textStyles.caption,
                                                    styles.callMeta,
                                                ]}
                                            >
                                                {districtPoiLayerLabel(panel.poi)}
                                            </Text>
                                        </View>
                                        <Pressable
                                            onPress={() => setPanel(null)}
                                            hitSlop={12}
                                        >
                                            <Ionicons
                                                name="close"
                                                size={26}
                                                color={colors.textDim}
                                            />
                                        </Pressable>
                                    </View>
                                    {panel.poi.photoUrl ? (
                                        <Image
                                            source={{ uri: panel.poi.photoUrl }}
                                            style={styles.poiPhoto}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View
                                            style={[
                                                styles.poiPhoto,
                                                {
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="image-outline"
                                                size={48}
                                                color={colors.textDim}
                                            />
                                        </View>
                                    )}
                                    <Text
                                        style={[
                                            textStyles.body,
                                            { color: colors.textMuted },
                                        ]}
                                    >
                                        {panel.poi.address}
                                    </Text>
                                    {panel.poi.schedule ? (
                                        <Text
                                            style={[
                                                textStyles.caption,
                                                {
                                                    color: colors.textDim,
                                                    lineHeight: 20,
                                                },
                                            ]}
                                        >
                                            {panel.poi.schedule}
                                        </Text>
                                    ) : null}
                                    <Button
                                        title="Проложить путь"
                                        onPress={() => setNavPickerOpen(true)}
                                    />
                                </>
                            ) : null}
                            {panel?.kind === "search" ? (
                                <>
                                    <View style={styles.modalHeader}>
                                        <View style={{ flex: 1, gap: 4 }}>
                                            <Text
                                                style={[
                                                    textStyles.subtitle,
                                                    styles.callTitle,
                                                ]}
                                            >
                                                {panel.hit.title}
                                            </Text>
                                            <Text
                                                style={[
                                                    textStyles.caption,
                                                    styles.callMeta,
                                                ]}
                                            >
                                                Адрес из поиска
                                            </Text>
                                        </View>
                                        <Pressable
                                            onPress={() => setPanel(null)}
                                            hitSlop={12}
                                        >
                                            <Ionicons
                                                name="close"
                                                size={26}
                                                color={colors.textDim}
                                            />
                                        </Pressable>
                                    </View>
                                    <View
                                        style={[
                                            styles.poiPhoto,
                                            {
                                                alignItems: "center",
                                                justifyContent: "center",
                                            },
                                        ]}
                                    >
                                        <Ionicons
                                            name="search"
                                            size={48}
                                            color={colors.warning}
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            textStyles.body,
                                            { color: colors.textMuted },
                                        ]}
                                    >
                                        {panel.hit.address}
                                    </Text>
                                    <Button
                                        title="Проложить путь"
                                        onPress={() => setNavPickerOpen(true)}
                                    />
                                </>
                            ) : null}
                        </Pressable>
                    </Pressable>
                </Modal>

                <Modal
                    visible={navVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setNavPickerOpen(false)}
                >
                    <Pressable
                        style={styles.modalRoot}
                        onPress={() => setNavPickerOpen(false)}
                    >
                        <Pressable
                            style={styles.modalCard}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Text style={[textStyles.subtitle, styles.callTitle]}>
                                Открыть маршрут в
                            </Text>
                            <Text
                                style={[
                                    textStyles.caption,
                                    styles.callMeta,
                                    { marginBottom: 4 },
                                ]}
                            >
                                В браузере старт «отсюда» не передаётся.
                            </Text>
                            <ScrollView
                                style={{ maxHeight: 320 }}
                                keyboardShouldPersistTaps="handled"
                            >
                                <NavOption
                                    icon="map-outline"
                                    title="Яндекс Карты"
                                    onPress={() => {
                                        if (!panel) return;
                                        const { lat, lng } = navLatLng(panel);
                                        openNavigator("yandex", lat, lng);
                                    }}
                                />
                                <View style={{ height: 10 }} />
                                <NavOption
                                    icon="navigate-outline"
                                    title="2ГИС"
                                    onPress={() => {
                                        if (!panel) return;
                                        const { lat, lng } = navLatLng(panel);
                                        openNavigator("dgis", lat, lng);
                                    }}
                                />
                                <View style={{ height: 10 }} />
                                <NavOption
                                    icon="phone-portrait-outline"
                                    title="Карты на устройстве"
                                    onPress={() => {
                                        if (!panel) return;
                                        const { lat, lng } = navLatLng(panel);
                                        openNavigator("system", lat, lng);
                                    }}
                                />
                            </ScrollView>
                            <Button
                                title="Отмена"
                                variant="secondary"
                                onPress={() => setNavPickerOpen(false)}
                            />
                        </Pressable>
                    </Pressable>
                </Modal>
            </View>
        );
    },
);

function NavOption({
    icon,
    title,
    onPress,
}: {
    icon: ComponentProps<typeof Ionicons>["name"];
    title: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.navRow,
                pressed && styles.navRowPressed,
            ]}
        >
            <Ionicons name={icon} size={22} color={colors.primary} />
            <Text style={[textStyles.subtitle, { color: colors.text, flex: 1 }]}>
                {title}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>
    );
}
