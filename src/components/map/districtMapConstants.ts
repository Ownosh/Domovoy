import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import type {
    DistrictMapLayerId,
    DistrictPoi,
    DistrictSearchHit,
} from "../../types";
import { colors, radius, spacing } from "../../theme";

export type DistrictMapProps = {
    pois: DistrictPoi[];
    schematicWidth?: number;
    mapFocus?: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    } | null;
    searchHit?: DistrictSearchHit | null;
};

export type IonIconName = ComponentProps<typeof Ionicons>["name"];

export type DistrictLayerMeta = {
    id: DistrictMapLayerId;
    label: string;
    shortLabel: string;
    group: "base" | "house";
    color: string;
    icon: IonIconName;
};

export const DISTRICT_LAYER_META: DistrictLayerMeta[] = [
    {
        id: "schools_daycare",
        label: "Школы и детские сады",
        shortLabel: "Школы / сады",
        group: "base",
        color: "#5b8fd6",
        icon: "school-outline",
    },
    {
        id: "clinic_pharmacy",
        label: "Поликлиники",
        shortLabel: "Медицина",
        group: "base",
        color: "#e05d8c",
        icon: "medical-outline",
    },
    {
        id: "grocery",
        label: "Продуктовые магазины",
        shortLabel: "Продукты",
        group: "base",
        color: "#d4a853",
        icon: "cart-outline",
    },
    {
        id: "parks",
        label: "Парки и скверы",
        shortLabel: "Парки",
        group: "base",
        color: "#3d9e7a",
        icon: "leaf-outline",
    },
    {
        id: "bus_stops_city",
        label: "Остановки (город)",
        shortLabel: "Автобусы",
        group: "base",
        color: "#7b68c8",
        icon: "bus-outline",
    },
    {
        id: "parking_city",
        label: "Парковки (город)",
        shortLabel: "Парковки",
        group: "base",
        color: "#8899a6",
        icon: "car-outline",
    },
    {
        id: "waste_yard",
        label: "Контейнеры у дома",
        shortLabel: "Мусор",
        group: "house",
        color: "#a67c52",
        icon: "trash-outline",
    },
    {
        id: "bus_stops_house",
        label: "Остановки у дома",
        shortLabel: "Рядом",
        group: "house",
        color: "#9b7bd4",
        icon: "bus-outline",
    },
    {
        id: "parking_house",
        label: "Парковка жильцов",
        shortLabel: "Двор",
        group: "house",
        color: "#6a8caf",
        icon: "car-outline",
    },
];

const layerColorById: Record<DistrictMapLayerId, string> = Object.fromEntries(
    DISTRICT_LAYER_META.map((m) => [m.id, m.color]),
) as Record<DistrictMapLayerId, string>;

const layerLabelById: Record<DistrictMapLayerId, string> = Object.fromEntries(
    DISTRICT_LAYER_META.map((m) => [m.id, m.label]),
) as Record<DistrictMapLayerId, string>;

const layerIconById: Record<DistrictMapLayerId, IonIconName> =
    Object.fromEntries(
        DISTRICT_LAYER_META.map((m) => [m.id, m.icon]),
    ) as Record<DistrictMapLayerId, IonIconName>;

export function districtPoiColor(poi: DistrictPoi): string {
    return layerColorById[poi.layerId];
}

export function districtPoiLayerLabel(poi: DistrictPoi): string {
    return layerLabelById[poi.layerId];
}

export function districtPoiLayerIcon(poi: DistrictPoi): IonIconName {
    return layerIconById[poi.layerId];
}

export const districtMapStyles = StyleSheet.create({
    wrap: { gap: 0 },
    mapWrap: {
        borderRadius: radius.lg,
        overflow: "hidden",
        position: "relative",
    },
    map: {
        width: "100%",
        height: 280,
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: colors.bg,
    },
    markerBubble: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
    },
    callout: {
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    callTitle: { color: colors.text },
    callMeta: { color: colors.textMuted, marginTop: spacing.xs },
    modalRoot: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: colors.overlay,
    },
    modalCard: {
        backgroundColor: colors.bgElevated,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderBottomWidth: 0,
        padding: spacing.lg,
        paddingBottom: spacing.xxxl,
        gap: spacing.md,
        maxHeight: "88%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: spacing.md,
    },
    poiPhoto: {
        width: "100%",
        height: 160,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
    },
    navRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    navRowPressed: { opacity: 0.85 },
    webMap: {
        alignSelf: "center",
        borderRadius: radius.lg,
        backgroundColor: "#1a2838",
        overflow: "hidden",
        position: "relative",
        borderWidth: 1,
        borderColor: colors.border,
    },
    webGrid: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.12,
        backgroundColor: "transparent",
    },
    webPin: {
        position: "absolute",
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.bg,
    },
    webHint: {
        color: colors.textDim,
        textAlign: "center",
        paddingHorizontal: spacing.sm,
    },
});
