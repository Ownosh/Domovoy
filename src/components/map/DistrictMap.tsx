import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
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
import WebView, { type WebViewMessageEvent } from "react-native-webview";
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

type WebViewDataMessage =
    | { type: "ready" }
    | { type: "poi"; id?: string }
    | { type: "search"; id?: string }
    | { type: "debug"; msg: string }
    | { type: "jsError"; msg: string };

const YANDEX_MAPS_API_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

function buildMapHtml(centerLat: number, centerLng: number): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; }
    #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #1a2838; }
  </style>
  <script>
    // Отключаем WebGL до загрузки API Яндекс.Карт: внутри WebView векторный
    // (WebGL) рендер часто рисует чёрный канвас, поэтому форсируем растровые тайлы.
    try { delete window.WebGLRenderingContext; } catch (e) { window.WebGLRenderingContext = undefined; }
  </script>
  <script src="https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var poiPlacemarks = {};
    var searchPlacemark = null;

    function post(msg) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }

    function setPois(pois) {
      Object.keys(poiPlacemarks).forEach(function (id) {
        map.geoObjects.remove(poiPlacemarks[id]);
      });
      poiPlacemarks = {};
      pois.forEach(function (p) {
        var pm = new ymaps.Placemark([p.lat, p.lng], {}, {
          preset: 'islands#circleIcon',
          iconColor: p.color
        });
        pm.events.add('click', function () {
          post({ type: 'poi', id: p.id });
        });
        map.geoObjects.add(pm);
        poiPlacemarks[p.id] = pm;
      });
      if (pois.length > 0) {
        map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
      }
    }

    function setSearchHit(hit) {
      if (searchPlacemark) {
        map.geoObjects.remove(searchPlacemark);
        searchPlacemark = null;
      }
      if (!hit) return;
      searchPlacemark = new ymaps.Placemark([hit.lat, hit.lng], {}, {
        preset: 'islands#circleIcon',
        iconColor: '${colors.warning}'
      });
      searchPlacemark.events.add('click', function () {
        post({ type: 'search', id: hit.id });
      });
      map.geoObjects.add(searchPlacemark);
    }

    function setCenter(lat, lng, zoom) {
      map.setCenter([lat, lng], zoom || map.getZoom(), { duration: 300 });
    }

    function handleMessage(e) {
      var data;
      try { data = JSON.parse(e.data); } catch (err) { return; }
      if (data.type === 'pois') setPois(data.pois);
      if (data.type === 'searchHit') setSearchHit(data.hit);
      if (data.type === 'center') setCenter(data.lat, data.lng, data.zoom);
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    window.onerror = function (msg, src, line, col) {
      post({ type: 'jsError', msg: String(msg) + ' @ ' + line + ':' + col });
    };

    post({ type: 'debug', msg: 'script started, ymaps=' + (typeof ymaps) });

    if (typeof ymaps === 'undefined') {
      post({ type: 'jsError', msg: 'ymaps is undefined - API script failed to load' });
    } else {
      ymaps.ready(function () {
        var mapDiv = document.getElementById('map');
        post({ type: 'debug', msg: 'ymaps.ready fired, #map size=' + mapDiv.offsetWidth + 'x' + mapDiv.offsetHeight });
        try {
          map = new ymaps.Map('map', {
            center: [${centerLat}, ${centerLng}],
            zoom: 14,
            controls: ['zoomControl']
          });
          post({ type: 'debug', msg: 'map created ok' });
        } catch (err) {
          post({ type: 'jsError', msg: 'map creation failed: ' + (err && err.message ? err.message : String(err)) });
          return;
        }
        post({ type: 'ready' });
      });
    }
  </script>
</body>
</html>`;
}

export const DistrictMap = forwardRef<DistrictMapHandle, DistrictMapProps>(
    function DistrictMap(
        { pois, mapFocus, searchHit }: DistrictMapProps,
        ref,
    ) {
        const insets = useSafeAreaInsets();
        const webViewRef = useRef<WebView>(null);
        const [mapReady, setMapReady] = useState(false);
        const [panel, setPanel] = useState<DetailPanel | null>(null);
        const [navPickerOpen, setNavPickerOpen] = useState(false);
        const [locationAllowed, setLocationAllowed] = useState(false);
        const [isFullscreen, setIsFullscreen] = useState(false);

        const mapHtml = useMemo(
            () => buildMapHtml(districtMapCenter.lat, districtMapCenter.lng),
            [],
        );

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
            setMapReady(false);
        }, [isFullscreen]);

        useEffect(() => {
            if (!mapReady) return;
            const payload = pois.map((p) => ({
                id: p.id,
                lat: p.lat,
                lng: p.lng,
                color: districtPoiColor(p),
            }));
            webViewRef.current?.postMessage(JSON.stringify({ type: "pois", pois: payload }));
        }, [mapReady, pois]);

        useEffect(() => {
            if (!mapReady) return;
            webViewRef.current?.postMessage(
                JSON.stringify({
                    type: "searchHit",
                    hit: searchHit
                        ? { id: searchHit.id, lat: searchHit.lat, lng: searchHit.lng }
                        : null,
                }),
            );
        }, [mapReady, searchHit]);

        useEffect(() => {
            if (!mapReady || !mapFocus) return;
            webViewRef.current?.postMessage(
                JSON.stringify({
                    type: "center",
                    lat: mapFocus.latitude,
                    lng: mapFocus.longitude,
                    zoom: 16,
                }),
            );
        }, [mapReady, mapFocus]);

        const handleWebViewMessage = useCallback(
            (event: WebViewMessageEvent) => {
                let data: WebViewDataMessage;
                try {
                    data = JSON.parse(event.nativeEvent.data);
                } catch {
                    return;
                }
                if (data.type === "ready") {
                    setMapReady(true);
                    return;
                }
                if (data.type === "debug") {
                    console.log("[DistrictMap]", data.msg);
                    return;
                }
                if (data.type === "jsError") {
                    console.error("[DistrictMap]", data.msg);
                    return;
                }
                if (data.type === "poi") {
                    const poi = pois.find((p) => p.id === data.id);
                    if (poi) {
                        setNavPickerOpen(false);
                        setPanel({ kind: "poi", poi });
                    }
                    return;
                }
                if (data.type === "search" && searchHit) {
                    setNavPickerOpen(false);
                    setPanel({ kind: "search", hit: searchHit });
                }
            },
            [pois, searchHit],
        );

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
                <WebView
                    ref={webViewRef}
                    source={{ html: mapHtml, baseUrl: "https://localhost" }}
                    style={fullscreen ? mapFullStyles.map : styles.map}
                    onMessage={handleWebViewMessage}
                    originWhitelist={["*"]}
                    javaScriptEnabled
                    domStorageEnabled
                    geolocationEnabled={locationAllowed}
                    androidLayerType="software"
                />
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
        ), [handleWebViewMessage, insets.top, locationAllowed, mapHtml]);

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
