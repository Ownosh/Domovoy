import React, { useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../context/AppContext";
import { colors, radius, spacing, textStyles } from "../../theme";
import type { UserApartment } from "../../types";

const statusDotColor: Record<string, string> = {
    approved: colors.primary,
    pending:  colors.warning,
    rejected: colors.danger,
    none:     colors.textDim,
};

export function ApartmentSwitcher() {
    const { apartments, activateApartment, profile } = useApp();
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState<string | null>(null);

    if (apartments.length < 2) return null;

    const active = apartments.find((a) => a.isActive);
    const displayApt = active?.apartment ?? profile.apartment;
    const displayBuilding = active?.buildingName ?? profile.buildingName ?? profile.building;
    const shortBuilding = displayBuilding.length > 22
        ? displayBuilding.slice(0, 20) + "…"
        : displayBuilding;

    const handleSwitch = async (apt: UserApartment) => {
        if (apt.isActive) { setOpen(false); return; }
        setSwitching(apt.id);
        await activateApartment(apt.id);
        setSwitching(null);
        setOpen(false);
    };

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                hitSlop={8}
            >
                <Ionicons name="home-outline" size={13} color={colors.primary} />
                <Text style={styles.chipText} numberOfLines={1}>
                    кв. {displayApt}
                </Text>
                <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                        {/* Шапка */}
                        <View style={styles.sheetHeader}>
                            <Text style={[textStyles.subtitle, styles.sheetTitle]}>Мои квартиры</Text>
                            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                                <Ionicons name="close" size={22} color={colors.textMuted} />
                            </Pressable>
                        </View>

                        <Text style={styles.sheetHint}>
                            Выберите квартиру, от имени которой действуете в приложении
                        </Text>

                        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                            {apartments.map((apt) => {
                                const dotColor = statusDotColor[apt.verificationStatus] ?? colors.textDim;
                                const isLoading = switching === apt.id;
                                return (
                                    <Pressable
                                        key={apt.id}
                                        onPress={() => { void handleSwitch(apt); }}
                                        disabled={!!switching}
                                        style={({ pressed }) => [
                                            styles.aptRow,
                                            apt.isActive && styles.aptRowActive,
                                            pressed && !apt.isActive && styles.aptRowPressed,
                                        ]}
                                    >
                                        {/* Иконка-круг */}
                                        <View style={[
                                            styles.aptIcon,
                                            apt.isActive && styles.aptIconActive,
                                        ]}>
                                            <Ionicons
                                                name="home"
                                                size={18}
                                                color={apt.isActive ? colors.primary : colors.textMuted}
                                            />
                                        </View>

                                        {/* Текст */}
                                        <View style={styles.aptText}>
                                            <View style={styles.aptTitleRow}>
                                                <Text style={[
                                                    styles.aptAddress,
                                                    apt.isActive && styles.aptAddressActive,
                                                ]} numberOfLines={1}>
                                                    {apt.buildingName}
                                                </Text>
                                                <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                                            </View>
                                            <Text style={styles.aptAptLine}>
                                                Квартира {apt.apartment}
                                                {apt.entrance ? `, подъезд ${apt.entrance}` : ""}
                                            </Text>
                                        </View>

                                        {/* Правая часть */}
                                        <View style={styles.aptRight}>
                                            {isLoading ? (
                                                <Ionicons name="reload-outline" size={18} color={colors.textDim} />
                                            ) : apt.isActive ? (
                                                <View style={styles.activeCheck}>
                                                    <Ionicons name="checkmark" size={13} color={colors.bg} />
                                                </View>
                                            ) : (
                                                <Ionicons name="chevron-forward" size={16} color={colors.textDim} style={{ opacity: 0.5 }} />
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.full,
        backgroundColor: "rgba(61, 158, 122, 0.12)",
        borderWidth: 1,
        borderColor: `${colors.primary}40`,
        maxWidth: 180,
    },
    chipPressed: { opacity: 0.75 },
    chipText: {
        fontSize: 12,
        fontWeight: "600",
        color: colors.primary,
        flexShrink: 1,
    },

    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: colors.bgElevated,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
        maxHeight: "80%",
    },
    sheetHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xs,
    },
    sheetTitle: { color: colors.text, fontSize: 17 },
    sheetHint: {
        fontSize: 12,
        color: colors.textDim,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        lineHeight: 17,
    },
    list: {
        paddingHorizontal: spacing.lg,
    },

    aptRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: "transparent",
        backgroundColor: colors.surface,
    },
    aptRowActive: {
        borderColor: `${colors.primary}50`,
        backgroundColor: colors.primarySoft,
    },
    aptRowPressed: { opacity: 0.75 },

    aptIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(154, 165, 181, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    aptIconActive: { backgroundColor: "rgba(61, 158, 122, 0.15)" },

    aptText: { flex: 1, gap: 2 },
    aptTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    aptAddress: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textMuted,
        flex: 1,
    },
    aptAddressActive: { color: colors.text },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        flexShrink: 0,
    },
    aptAptLine: {
        fontSize: 12,
        color: colors.textDim,
    },
    aptRight: {
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        width: 28,
    },
    activeCheck: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
});
