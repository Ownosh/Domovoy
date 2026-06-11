import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import {
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import YaMap, { Marker } from "react-native-yamap";
import { districtMapCenter } from "../../data/mockData";
import { Button } from "../ui/Button";
import { colors, textStyles } from "../../theme";
import type { DistrictPoi, DistrictSearchHit } from "../../types";
import type { ExternalNavigatorApp } from "../../utils/openNavigatorRoute";
import { openRouteInExternalNavigator } from "../../utils/openNavigatorRoute";
import {
    districtMapStyles as styles,
    districtPoiColor,
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
        { pois, mapFocus, searchHit }: DistrictMapProps,
        ref,
    ) {
        const insets = useSafeAreaInsets();
        const mapRef = useRef<YaMap>(null);
        const [panel, setPanel] = useState<DetailPanel | null>(null);
        const [navPickerOpen, setNavPickerOpen] = useState(false);
        const [locationAllowed, setLocationAllowed] = useState(false);
        const [isFullscreen, setIsFullscreen] = useState(false);

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

        useEffect(() => {
            if (Platform.OS === "web") return;
            let cancelled = false;
            (async () => {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (!cancelled && status === Location.PermissionStatus.GRANTED) {
                    setLocationAllowed(true);
                }
            })();
            return () => {
                cancelled = true;
            };
        }, []);

        useEffect(() => {
            if (pois.length === 0) return;
            const points = pois.map((p) => ({ lat: p.lat, lon: p.lng }));
            const timeout = setTimeout(() => {
                mapRef.current?.fitMarkers(points);
            }, 300);
            return () => clearTimeout(timeout);
        }, [pois, isFullscreen]);

        useEffect(() => {
            if (!mapFocus) return;
            mapRef.current?.setCenter(
                { lat: mapFocus.latitude, lon: mapFocus.longitude },
                16,
                0,
                0,
                300,
            );
        }, [mapFocus]);

        const handlePoiPress = useCallback((poi: DistrictPoi) => {
            setNavPickerOpen(false);
            setPanel({ kind: "poi", poi });
        }, []);

        const handleSearchPress = useCallback(() => {
            if (!searchHit) return;
            setNavPickerOpen(false);
            setPanel({ kind: "search", hit: searchHit });
        }, [searchHit]);

        const destCoords = useCallback((d: DetailPanel) => {
            if (d.kind === "poi") {
                return { lat: d.poi.lat, lng: d.poi.lng };
            }
            return { lat: d.hit.lat, lng: d.hit.lng };
        }, []);

        const openNavigator = useCallback(
            async (app: ExternalNavigatorApp, d: DetailPanel) => {
                const { lat, lng } = destCoords(d);
                let origin: { lat: number; lng: number } | undefined;
                if (Platform.OS !== "web") {
                    const perm = await Location.requestForegroundPermissionsAsync();
                    if (perm.status === Location.PermissionStatus.GRANTED) {
                        setLocationAllowed(true);
                        try {
                            const pos = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.Balanced,
                            });
                            origin = {
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude,
                            };
                        } catch {
                            origin = undefined;
                        }
                    }
                }
                openRouteInExternalNavigator(app, { lat, lng }, origin);
                setNavPickerOpen(false);
                setPanel(null);
            },
            [destCoords],
        );

        const renderMapView = useCallback((fullscreen: boolean) => (
            <View style={fullscreen ? mapFullStyles.mapWrap : styles.mapWrap}>
                <YaMap
                    ref={mapRef}
                    style={fullscreen ? mapFullStyles.map : styles.map}
                    initialRegion={{
                        lat: districtMapCenter.lat,
                        lon: districtMapCenter.lng,
                        zoom: 14,
                    }}
                    showUserPosition={locationAllowed}
                >
                    {pois.map((p) => (
                        <Marker
                            key={p.id}
                            point={{ lat: p.lat, lon: p.lng }}
                            onPress={() => handlePoiPress(p)}
                        >
                            <View
                                style={[
                                    mapFullStyles.poiDot,
                                    { backgroundColor: districtPoiColor(p) },
                                ]}
                            />
                        </Marker>
                    ))}
                    {searchHit ? (
                        <Marker
                            point={{ lat: searchHit.lat, lon: searchHit.lng }}
                            onPress={handleSearchPress}
                        >
                            <View
                                style={[
                                    mapFullStyles.poiDot,
                                    { backgroundColor: colors.warning },
                                ]}
                            />
                        </Marker>
                    ) : null}
                </YaMap>
                <Pressable
                    onPress={() => setIsFullscreen((v) => !v)}
                    hitSlop={8}
                    style={({ pressed }) => [
                        mapFullStyles.expandBtn,
                        fullscreen && { top: insets.top + 12 },
                        pressed && mapFullStyles.expandBtnPressed,
                    ]}
                >
                    <Ionicons
                        name={fullscreen ? "contract-outline" : "expand-outline"}
                        size={20}
                        color={colors.text}
                    />
                </Pressable>
            </View>
        ), [handlePoiPress, handleSearchPress, insets.top, locationAllowed, pois, searchHit]);

        const detailVisible = panel !== null && !navPickerOpen;
        const navVisible = navPickerOpen && panel !== null;

        const renderDetailContent = () => (
            <>
                {panel?.kind === "poi" ? (
                    <>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, gap: 4 }}>
                                <Text style={[textStyles.subtitle, styles.callTitle]}>
                                    {panel.poi.name}
                                </Text>
                                <Text style={[textStyles.caption, styles.callMeta]}>
                                    {districtPoiLayerLabel(panel.poi)}
                                </Text>
                            </View>
                            <Pressable onPress={() => setPanel(null)} hitSlop={12}>
                                <Ionicons name="close" size={26} color={colors.textDim} />
                            </Pressable>
                        </View>
                        {panel.poi.photoUrl ? (
                            <Image
                                source={{ uri: panel.poi.photoUrl }}
                                style={styles.poiPhoto}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={[styles.poiPhoto, { alignItems: "center", justifyContent: "center" }]}>
                                <Ionicons name="image-outline" size={48} color={colors.textDim} />
                            </View>
                        )}
                        <Text style={[textStyles.body, { color: colors.textMuted }]}>
                            {panel.poi.address}
                        </Text>
                        {panel.poi.schedule ? (
                            <Text style={[textStyles.caption, { color: colors.textDim, lineHeight: 20 }]}>
                                {panel.poi.schedule}
                            </Text>
                        ) : null}
                        <Button title="Проложить путь" onPress={() => setNavPickerOpen(true)} />
                    </>
                ) : null}
                {panel?.kind === "search" ? (
                    <>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, gap: 4 }}>
                                <Text style={[textStyles.subtitle, styles.callTitle]}>
                                    {panel.hit.title}
                                </Text>
                                <Text style={[textStyles.caption, styles.callMeta]}>
                                    Адрес из поиска
                                </Text>
                            </View>
                            <Pressable onPress={() => setPanel(null)} hitSlop={12}>
                                <Ionicons name="close" size={26} color={colors.textDim} />
                            </Pressable>
                        </View>
                        <View style={[styles.poiPhoto, { alignItems: "center", justifyContent: "center" }]}>
                            <Ionicons name="search" size={48} color={colors.warning} />
                        </View>
                        <Text style={[textStyles.body, { color: colors.textMuted }]}>
                            {panel.hit.address}
                        </Text>
                        <Button title="Проложить путь" onPress={() => setNavPickerOpen(true)} />
                    </>
                ) : null}
            </>
        );

        const renderNavContent = () => (
            <>
                <Text style={[textStyles.subtitle, styles.callTitle]}>
                    Открыть маршрут в
                </Text>
                <Text style={[textStyles.caption, styles.callMeta, { marginBottom: 4 }]}>
                    Точка старта — ваше местоположение (если разрешена геолокация).
                    Иначе откроется только точка на карте.
                </Text>
                <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                    <NavOption
                        icon="map-outline"
                        title="Яндекс Карты"
                        onPress={() => panel && openNavigator("yandex", panel)}
                    />
                    <View style={{ height: 10 }} />
                    <NavOption
                        icon="navigate-outline"
                        title="2ГИС"
                        onPress={() => panel && openNavigator("dgis", panel)}
                    />
                    <View style={{ height: 10 }} />
                    <NavOption
                        icon="phone-portrait-outline"
                        title={Platform.OS === "ios" ? "Карты (Apple)" : "Карты на телефоне"}
                        onPress={() => panel && openNavigator("system", panel)}
                    />
                </ScrollView>
                <Button
                    title="Отмена"
                    variant="secondary"
                    onPress={() => setNavPickerOpen(false)}
                />
            </>
        );

        return (
            <View style={styles.wrap}>
                {!isFullscreen && renderMapView(false)}

                <Modal
                    visible={isFullscreen}
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={() => setIsFullscreen(false)}
                >
                    <View style={mapFullStyles.fullscreenRoot}>
                        {isFullscreen && renderMapView(true)}

                        {detailVisible && (
                            <Pressable
                                style={[StyleSheet.absoluteFill, styles.modalRoot]}
                                onPress={() => setPanel(null)}
                            >
                                <Pressable
                                    style={styles.modalCard}
                                    onPress={(e) => e.stopPropagation()}
                                >
                                    {renderDetailContent()}
                                </Pressable>
                            </Pressable>
                        )}

                        {navVisible && (
                            <Pressable
                                style={[StyleSheet.absoluteFill, styles.modalRoot]}
                                onPress={() => setNavPickerOpen(false)}
                            >
                                <Pressable
                                    style={styles.modalCard}
                                    onPress={(e) => e.stopPropagation()}
                                >
                                    {renderNavContent()}
                                </Pressable>
                            </Pressable>
                        )}
                    </View>
                </Modal>

                {!isFullscreen && (
                    <>
                        <Modal
                            visible={detailVisible}
                            transparent
                            animationType="slide"
                            onRequestClose={() => setPanel(null)}
                        >
                            <Pressable style={styles.modalRoot} onPress={() => setPanel(null)}>
                                <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                                    {renderDetailContent()}
                                </Pressable>
                            </Pressable>
                        </Modal>

                        <Modal
                            visible={navVisible}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setNavPickerOpen(false)}
                        >
                            <Pressable style={styles.modalRoot} onPress={() => setNavPickerOpen(false)}>
                                <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                                    {renderNavContent()}
                                </Pressable>
                            </Pressable>
                        </Modal>
                    </>
                )}
            </View>
        );
    },
);

const mapFullStyles = StyleSheet.create({
    fullscreenRoot: {
        flex: 1,
        backgroundColor: "#000",
    },
    mapWrap: {
        flex: 1,
        position: "relative",
    },
    map: {
        flex: 1,
    },
    poiDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: colors.bg,
    },
    expandBtn: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 3,
    },
    expandBtnPressed: { opacity: 0.75 },
});

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
