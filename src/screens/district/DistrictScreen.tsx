import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Image,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    DistrictMap,
    type DistrictMapHandle,
} from "../../components/map/DistrictMap";
import {
    DISTRICT_LAYER_META,
    districtPoiColor,
    districtPoiLayerIcon,
    districtPoiLayerLabel,
    type DistrictLayerMeta,
} from "../../components/map/districtMapConstants";
import { Card, Input, ScreenLayout } from "../../components/ui";
import { districtPois, homeMapAnchor } from "../../data/mockData";
import { apiFetchDistrictPois } from "../../api/district";
import { useApp } from "../../context/AppContext";
import type { MainTabNavigationProp } from "../../navigation/types";
import type {
    DistrictMapLayerId,
    DistrictPoi,
    DistrictSearchHit,
} from "../../types";
import {
    loadDistrictMapActiveLayers,
    saveDistrictMapActiveLayers,
} from "../../utils/districtMapLayerStorage";
import {
    getDistrictPoiRating,
    isBusStopLayer,
    pickNearestOnly,
    pickThreeRepresentatives,
    type DistrictPickKind,
} from "../../utils/districtPoiPick";
import { formatDistanceKm, haversineKm } from "../../utils/haversineKm";
import { nominatimSearchKirov } from "../../utils/nominatimSearch";
import { colors, radius, spacing, textStyles } from "../../theme";

/** По умолчанию: у дома + школы/сады и поликлиники/аптеки по всему городу. */
const DEFAULT_ACTIVE_LAYERS: DistrictMapLayerId[] = [
    ...DISTRICT_LAYER_META.filter((m) => m.group === "house").map((m) => m.id),
    "schools_daycare",
    "clinic_pharmacy",
];

const MAP_H = 280;

/** Не показываем на левой панели «Город» (парковки и остановки города). */
const HIDDEN_CITY_RAIL_IDS = new Set<DistrictMapLayerId>([
    "bus_stops_city",
    "parking_city",
]);

const STRIP_FROM_ACTIVE_LAYERS = HIDDEN_CITY_RAIL_IDS;

export function DistrictScreen() {
    const navigation = useNavigation<MainTabNavigationProp>();
    const { isAuthenticated } = useApp();
    const mapRef = useRef<DistrictMapHandle>(null);
    const [activeLayers, setActiveLayers] =
        useState<DistrictMapLayerId[]>(DEFAULT_ACTIVE_LAYERS);
    const [pois, setPois] = useState<DistrictPoi[]>(districtPois);
    const [home, setHome] = useState(homeMapAnchor);
    const [mapInnerWidth, setMapInnerWidth] = useState<number | undefined>(
        undefined,
    );
    const [mapFocus, setMapFocus] = useState<{
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    } | null>(null);
    const [searchHit, setSearchHit] = useState<DistrictSearchHit | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<
        { id: string; title: string; address: string; lat: number; lng: number }[]
    >([]);
    const searchRequestSeq = useRef(0);

    useEffect(() => {
        let cancelled = false;
        loadDistrictMapActiveLayers().then((saved) => {
            if (!cancelled && saved !== null) {
                setActiveLayers(
                    saved.filter((id) => !STRIP_FROM_ACTIVE_LAYERS.has(id)),
                );
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        apiFetchDistrictPois()
            .then(({ anchor, pois: fetched }) => {
                if (fetched.length > 0) setPois(fetched);
                if (anchor) setHome(anchor);
            })
            .catch(() => {});
    }, [isAuthenticated]);

    useEffect(() => {
        void saveDistrictMapActiveLayers(activeLayers);
    }, [activeLayers]);

    const toggleLayer = useCallback((id: DistrictMapLayerId) => {
        setActiveLayers((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }, []);

    const visiblePois = useMemo(
        () => pois.filter((p) => activeLayers.includes(p.layerId)),
        [pois, activeLayers],
    );

    const baseLayers = useMemo(
        () =>
            DISTRICT_LAYER_META.filter(
                (m) => m.group === "base" && !HIDDEN_CITY_RAIL_IDS.has(m.id),
            ),
        [],
    );
    const houseLayers = useMemo(
        () => DISTRICT_LAYER_META.filter((m) => m.group === "house"),
        [],
    );

    const groupedSections = useMemo(() => {
        return DISTRICT_LAYER_META.filter((m) => activeLayers.includes(m.id))
            .map((meta) => {
                const rows = visiblePois
                    .filter((p) => p.layerId === meta.id)
                    .map((p) => ({
                        poi: p,
                        distanceKm: haversineKm(
                            home.lat,
                            home.lng,
                            p.lat,
                            p.lng,
                        ),
                    }));
                const items = isBusStopLayer(meta.id)
                    ? pickNearestOnly(rows)
                    : pickThreeRepresentatives(rows);
                return { meta, items };
            })
            .filter((s) => s.items.length > 0);
    }, [visiblePois, activeLayers, home.lat, home.lng]);

    const runAddressSearch = useCallback(
        async (qRaw: string) => {
            const q = qRaw.trim();
            const seq = ++searchRequestSeq.current;
            setSearchError(null);
            if (q.length < 3) {
                setSearchResults([]);
                setSearchError("Минимум 3 символа.");
                setSearchLoading(false);
                return;
            }
            setSearchLoading(true);
            try {
                const raw = await nominatimSearchKirov(q, 8);
                if (seq !== searchRequestSeq.current) return;
                setSearchResults(
                    raw.map((r) => ({
                        id: r.id,
                        title: r.displayName.split(",")[0]?.trim() || q,
                        address: r.displayName,
                        lat: r.lat,
                        lng: r.lng,
                    })),
                );
                if (raw.length === 0) {
                    setSearchError("Ничего не найдено.");
                }
            } catch {
                if (seq !== searchRequestSeq.current) return;
                setSearchError("Проверьте интернет.");
                setSearchResults([]);
            } finally {
                if (seq === searchRequestSeq.current) {
                    setSearchLoading(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        const q = searchQuery.trim();
        if (q.length < 3) {
            searchRequestSeq.current += 1;
            setSearchResults([]);
            setSearchError(null);
            setSearchLoading(false);
            return;
        }
        const t = setTimeout(() => {
            void runAddressSearch(q);
        }, 420);
        return () => clearTimeout(t);
    }, [searchQuery, runAddressSearch]);

    const onSearchSubmit = useCallback(() => {
        Keyboard.dismiss();
        void runAddressSearch(searchQuery);
    }, [runAddressSearch, searchQuery]);

    const applySearchHit = useCallback((row: (typeof searchResults)[0]) => {
        const hit: DistrictSearchHit = {
            id: row.id,
            title: row.title,
            address: row.address,
            lat: row.lat,
            lng: row.lng,
        };
        setSearchHit(hit);
        setMapFocus({
            latitude: row.lat,
            longitude: row.lng,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
        });
        mapRef.current?.showSearchDetail(hit);
        setSearchResults([]);
        setSearchQuery(row.title);
    }, []);

    const focusPoiOnMap = useCallback((poi: DistrictPoi) => {
        setSearchHit(null);
        setMapFocus({
            latitude: poi.lat,
            longitude: poi.lng,
            latitudeDelta: 0.035,
            longitudeDelta: 0.035,
        });
        mapRef.current?.showPoiDetail(poi);
    }, []);

    return (
        <ScreenLayout
            title="Район"
            scroll={false}
            contentStyle={styles.screenBody}
            rightAccessory={
                <Pressable
                    onPress={() => navigation.navigate("Profile")}
                    hitSlop={10}
                    style={({ pressed }) => [
                        styles.profileButton,
                        pressed && styles.profileButtonPressed,
                    ]}
                >
                    <Ionicons
                        name="person-circle-outline"
                        size={30}
                        color={colors.text}
                    />
                </Pressable>
            }
        >
            <View style={styles.screenColumn}>
                <ScrollView
                    style={styles.mainScroll}
                    contentContainerStyle={styles.mainScrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                >
                    <Card padded={false} style={styles.mapCard}>
                        <View style={styles.mapRow}>
                            <MapLayerRail
                                title="Город"
                                layers={baseLayers}
                                activeLayers={activeLayers}
                                onToggle={toggleLayer}
                                edge="left"
                            />
                            <View
                                style={styles.mapCenter}
                                onLayout={(e) =>
                                    setMapInnerWidth(
                                        Math.round(e.nativeEvent.layout.width),
                                    )
                                }
                            >
                                <DistrictMap
                                    ref={mapRef}
                                    pois={visiblePois}
                                    schematicWidth={mapInnerWidth}
                                    mapFocus={mapFocus}
                                    searchHit={searchHit}
                                />
                            </View>
                            <MapLayerRail
                                title="Дом"
                                layers={houseLayers}
                                activeLayers={activeLayers}
                                onToggle={toggleLayer}
                                edge="right"
                            />
                        </View>
                    </Card>

                    <Card style={styles.searchCard}>
                        <View style={styles.searchRow}>
                            <View style={styles.searchInputWrap}>
                                <Input
                                    placeholder="Адрес в Кирове…"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    onSubmitEditing={onSearchSubmit}
                                    returnKeyType="search"
                                    style={styles.searchInput}
                                />
                            </View>
                            <Pressable
                                onPress={onSearchSubmit}
                                style={({ pressed }) => [
                                    styles.searchBtn,
                                    pressed && styles.searchBtnPressed,
                                ]}
                                accessibilityLabel="Искать адрес"
                            >
                                {searchLoading ? (
                                    <ActivityIndicator color={colors.bg} />
                                ) : (
                                    <Ionicons
                                        name="search"
                                        size={22}
                                        color={colors.bg}
                                    />
                                )}
                            </Pressable>
                        </View>
                        {searchError ? (
                            <Text style={[textStyles.caption, styles.searchErr]}>
                                {searchError}
                            </Text>
                        ) : null}
                        {searchResults.map((r) => (
                            <Pressable
                                key={r.id}
                                onPress={() => applySearchHit(r)}
                                style={({ pressed }) => [
                                    styles.searchHitRow,
                                    pressed && styles.searchHitRowPressed,
                                ]}
                            >
                                <Ionicons
                                    name="location-outline"
                                    size={20}
                                    color={colors.warning}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={[
                                            textStyles.subtitle,
                                            styles.searchHitTitle,
                                        ]}
                                    >
                                        {r.title}
                                    </Text>
                                    <Text
                                        style={[
                                            textStyles.caption,
                                            styles.searchHitAddr,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {r.address}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={colors.textDim}
                                />
                            </Pressable>
                        ))}
                    </Card>

                    {groupedSections.length === 0 ? (
                        <Text style={[textStyles.body, styles.empty]}>
                            Нет точек в выбранных категориях.
                        </Text>
                    ) : (
                        groupedSections.map((section) => (
                            <View key={section.meta.id} style={styles.section}>
                                <Text
                                    style={[textStyles.subtitle, styles.sectionTitle]}
                                >
                                    {section.meta.label}
                                </Text>
                                {section.items.map((row) => (
                                    <View key={row.poi.id} style={styles.rowGap}>
                                        <Pressable
                                            onPress={() => focusPoiOnMap(row.poi)}
                                        >
                                            <PoiListRow
                                                poi={row.poi}
                                                distanceKm={row.distanceKm}
                                                pickKind={row.pickKind}
                                            />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </ScreenLayout>
    );
}

function MapLayerRail({
    title,
    layers,
    activeLayers,
    onToggle,
    edge,
}: {
    title: string;
    layers: DistrictLayerMeta[];
    activeLayers: DistrictMapLayerId[];
    onToggle: (id: DistrictMapLayerId) => void;
    edge: "left" | "right";
}) {
    return (
        <View
            style={[
                styles.rail,
                edge === "left" ? styles.railLeft : styles.railRight,
            ]}
        >
            <Text style={styles.railHeading}>{title}</Text>
            <ScrollView
                style={styles.railScroll}
                contentContainerStyle={styles.railScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {layers.map((m) => {
                    const on = activeLayers.includes(m.id);
                    return (
                        <Pressable
                            key={m.id}
                            accessibilityLabel={m.label}
                            accessibilityHint={
                                on
                                    ? "Скрыть категорию с карты"
                                    : "Показать категорию на карте"
                            }
                            onPress={() => onToggle(m.id)}
                            style={({ pressed }) => [
                                styles.railBtn,
                                on && {
                                    backgroundColor: m.color,
                                    borderColor: m.color,
                                },
                                !on && styles.railBtnOff,
                                pressed && styles.railBtnPressed,
                            ]}
                        >
                            <Ionicons
                                name={m.icon}
                                size={20}
                                color={on ? colors.bg : m.color}
                                style={!on ? styles.railIconDim : undefined}
                            />
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const PICK_KIND_LABEL: Record<DistrictPickKind, string> = {
    nearest: "Ближайший",
    rating: "Лучший",
    median: "Средний",
};

function pickKindTagStyle(kind: DistrictPickKind) {
    switch (kind) {
        case "nearest":
            return styles.pickTagNearest;
        case "rating":
            return styles.pickTagRating;
        default:
            return styles.pickTagMedian;
    }
}

function PoiListRow({
    poi,
    distanceKm,
    pickKind,
}: {
    poi: DistrictPoi;
    distanceKm: number;
    pickKind: DistrictPickKind;
}) {
    const c = districtPoiColor(poi);
    const stars = getDistrictPoiRating(poi).toFixed(1);
    const showRating = !isBusStopLayer(poi.layerId);
    return (
        <Card style={styles.poiCard}>
            <View style={styles.poiThumbWrap}>
                {poi.photoUrl ? (
                    <Image
                        source={{ uri: poi.photoUrl }}
                        style={styles.poiThumb}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.poiThumb, styles.poiThumbPlaceholder]}>
                        <Ionicons
                            name={districtPoiLayerIcon(poi)}
                            size={28}
                            color={c}
                        />
                    </View>
                )}
                <View style={[styles.poiBadge, { backgroundColor: c }]}>
                    <Ionicons
                        name={districtPoiLayerIcon(poi)}
                        size={12}
                        color={colors.bg}
                    />
                </View>
            </View>
            <View style={styles.poiText}>
                <View style={styles.poiTopRow}>
                    <Text style={[textStyles.caption, styles.poiCat]}>
                        {districtPoiLayerLabel(poi)}
                        {poi.scope === "house" ? " · у дома" : " · рядом"}
                    </Text>
                    <View style={[styles.pickTag, pickKindTagStyle(pickKind)]}>
                        <Text
                            style={[
                                styles.pickTagText,
                                pickKind === "nearest" && { color: colors.primary },
                                pickKind === "rating" && { color: colors.accent },
                                pickKind === "median" && { color: colors.info },
                            ]}
                        >
                            {PICK_KIND_LABEL[pickKind]}
                        </Text>
                    </View>
                </View>
                {showRating ? (
                    <Text style={[textStyles.caption, styles.poiStars]}>★ {stars}</Text>
                ) : null}
                <Text style={[textStyles.subtitle, styles.poiName]}>
                    {poi.name}
                </Text>
                <Text style={[textStyles.caption, styles.poiDist]}>
                    {formatDistanceKm(distanceKm)} от дома
                </Text>
                <Text style={[textStyles.caption, styles.poiAddr]}>
                    {poi.address}
                </Text>
                {poi.schedule ? (
                    <Text style={[textStyles.caption, styles.poiSchedule]}>
                        {poi.schedule}
                    </Text>
                ) : null}
            </View>
        </Card>
    );
}

const RAIL_W = 52;

const styles = StyleSheet.create({
    screenBody: { flex: 1 },
    screenColumn: { flex: 1 },
    mainScroll: { flex: 1 },
    mainScrollContent: {
        gap: spacing.lg,
        paddingBottom: spacing.xxxl * 2,
    },
    profileButton: { marginTop: spacing.xs },
    profileButtonPressed: { opacity: 0.6 },
    mapCard: {
        overflow: "hidden",
    },
    mapRow: {
        flexDirection: "row",
        alignItems: "stretch",
        minHeight: MAP_H,
    },
    mapCenter: {
        flex: 1,
        minWidth: 0,
        height: MAP_H,
        backgroundColor: colors.bg,
    },
    rail: {
        width: RAIL_W,
        height: MAP_H,
        flexDirection: "column",
        backgroundColor: "rgba(19, 26, 34, 0.97)",
        paddingTop: spacing.xs,
        paddingBottom: spacing.xs,
    },
    railLeft: {
        borderRightWidth: 1,
        borderRightColor: colors.borderSubtle,
    },
    railRight: {
        borderLeftWidth: 1,
        borderLeftColor: colors.borderSubtle,
    },
    railHeading: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: colors.textDim,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
    railScroll: { flex: 1 },
    railScrollContent: {
        alignItems: "center",
        gap: 10,
        paddingVertical: spacing.xs,
    },
    railBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    railBtnOff: {
        backgroundColor: "rgba(26, 35, 46, 0.85)",
    },
    railBtnPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
    railIconDim: { opacity: 0.42 },
    empty: { color: colors.textMuted, paddingVertical: spacing.md },
    section: { gap: spacing.sm },
    sectionTitle: { color: colors.text },
    rowGap: { marginBottom: spacing.sm },
    poiCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
    },
    poiThumbWrap: {
        position: "relative",
    },
    poiThumb: {
        width: 76,
        height: 76,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
    },
    poiThumbPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    poiBadge: {
        position: "absolute",
        right: -4,
        bottom: -4,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.bgElevated,
    },
    poiText: { flex: 1 },
    poiTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    poiCat: { color: colors.textDim, flex: 1, minWidth: 0 },
    pickTag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        flexShrink: 0,
    },
    pickTagNearest: { backgroundColor: colors.primarySoft },
    pickTagRating: { backgroundColor: colors.accentSoft },
    pickTagMedian: {
        backgroundColor: "rgba(91, 159, 212, 0.12)",
    },
    pickTagText: {
        fontSize: 11,
        fontWeight: "700",
    },
    poiStars: { color: colors.textDim, marginTop: 2 },
    poiName: { color: colors.text, marginTop: spacing.xs },
    poiDist: { color: colors.info, marginTop: spacing.xs },
    poiAddr: { color: colors.textMuted, marginTop: spacing.xs },
    poiSchedule: {
        color: colors.textDim,
        marginTop: spacing.sm,
        lineHeight: 20,
    },
    searchCard: { gap: spacing.sm },
    searchRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: spacing.sm,
    },
    searchInputWrap: { flex: 1 },
    searchInput: { marginBottom: 0 },
    searchBtn: {
        width: 48,
        height: 48,
        borderRadius: radius.md,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 2,
    },
    searchBtnPressed: { opacity: 0.9 },
    searchErr: { color: colors.danger },
    searchHitRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
    },
    searchHitRowPressed: { opacity: 0.88 },
    searchHitTitle: { color: colors.text },
    searchHitAddr: { color: colors.text, marginTop: 2 },
});
