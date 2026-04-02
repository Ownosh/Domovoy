import { StyleSheet } from "react-native";
import type { DistrictPoi, PoiCategory } from "../../types";
import { colors, radius, spacing } from "../../theme";

export const categoryColors: Record<PoiCategory, string> = {
    education: "#6b9fd4",
    health: "#e05d8c",
    shopping: "#d4a853",
    leisure: "#3d9e7a",
};

export const categoryLabels: Record<PoiCategory, string> = {
    education: "Образование",
    health: "Медицина",
    shopping: "Торговля",
    leisure: "Отдых",
};

export type DistrictMapProps = {
    pois: DistrictPoi[];
};

export const districtMapStyles = StyleSheet.create({
    wrap: { gap: spacing.md },
    map: {
        width: "100%",
        height: 280,
        borderRadius: radius.lg,
        overflow: "hidden",
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: colors.bg,
    },
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
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    webHint: {
        color: colors.textDim,
        textAlign: "center",
        paddingHorizontal: spacing.sm,
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
});
