import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Image as RNImage,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Button, Card, Input, NotificationBell, ScreenLayout, UkPublicStatsCard } from "../../components/ui";
import { useApp, isVerifiedResident } from "../../context/AppContext";
import type { MainTabNavigationProp } from "../../navigation/types";
import type {
    EnvironmentRatingFeedbackTagId,
    HouseCalendarActivity,
    HouseCalendarActivityKind,
} from "../../types";
import { colors, radius, spacing, textStyles } from "../../theme";

const STAR_SET = [1, 2, 3, 4, 5] as const;

type HouseTab = "calendar" | "passport" | "schedule" | "rating";

const HOUSE_TABS: { id: HouseTab; label: string }[] = [
    { id: "calendar", label: "Календарь" },
    { id: "passport", label: "Паспорт дома" },
    { id: "schedule", label: "Расписание" },
    { id: "rating", label: "Оценка УК" },
];

const ACTIVITY_DOT: Record<HouseCalendarActivityKind, string> = {
    yard: colors.primary,
    pipes: colors.info,
    meeting: "#a78bfa",
    heating: colors.warning,
    garbage: colors.textDim,
    other: colors.accent,
};

const ACTIVITY_LABEL: Record<HouseCalendarActivityKind, string> = {
    yard: "Двор / благоустройство",
    pipes: "Инженерные работы",
    meeting: "Собрания",
    heating: "Отопление",
    garbage: "Мусор / вывоз",
    other: "Прочее",
};

const FEEDBACK_OPTIONS: {
    id: EnvironmentRatingFeedbackTagId;
    label: string;
}[] = [
    { id: "yard", label: "Двор и благоустройство" },
    { id: "entrance", label: "Подъезд (чистота, освещение)" },
    { id: "uk_comm", label: "Связь с УК, диспетчеризация" },
    { id: "uk_work", label: "Качество и сроки работ УК" },
    { id: "contractors", label: "Подрядчики на доме" },
    { id: "safety", label: "Безопасность и порядок" },
    { id: "other", label: "Другое (опишите ниже)" },
];

function feedbackLabel(id: EnvironmentRatingFeedbackTagId): string {
    return FEEDBACK_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

function formatMonthKeyRu(monthKey: string): string {
    const [y, m] = monthKey.split("-").map(Number);
    if (!y || !m) return monthKey;
    const dt = new Date(y, m - 1, 1);
    return dt.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

function getCurrentMonthKey(d = new Date()): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function toIsoDate(y: number, m0: number, day: number): string {
    return `${y}-${pad2(m0 + 1)}-${pad2(day)}`;
}

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function monthLabelRu(d: Date): string {
    const raw = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function PassportDivider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}

function ScheduleDivider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}

function AgendaDivider() {
    return (
        <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
        </View>
    );
}

export function HousePassportScreen() {
    const navigation = useNavigation<MainTabNavigationProp>();
    const {
        environmentRating, setEnvironmentRating, verification, ukStats,
        houseInfo: buildingInfo,
        housePhotos: photos,
        houseSpecs: specs,
        houseSchedule: scheduleItems,
        houseCalendar: calendarActivities,
    } = useApp();
    const verified = isVerifiedResident(verification);
    const visibleTabs = HOUSE_TABS.filter((t) => verified || t.id !== "rating");
    const [tab, setTab] = useState<HouseTab>("calendar");
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
    const [ratingOpen, setRatingOpen] = useState(false);
    const [courtyard, setCourtyard] = useState<1 | 2 | 3 | 4 | 5>(4);
    const [entrance, setEntrance] = useState<1 | 2 | 3 | 4 | 5>(4);
    const [ukStars, setUkStars] = useState<1 | 2 | 3 | 4 | 5>(4);
    const [feedbackTags, setFeedbackTags] = useState<EnvironmentRatingFeedbackTagId[]>(
        [],
    );
    const [feedbackOther, setFeedbackOther] = useState("");
    const [agendaOpen, setAgendaOpen] = useState(false);
    const [dayDetailIso, setDayDetailIso] = useState<string | null>(null);

    const currentMonthKey = getCurrentMonthKey();
    const ratedThisMonth =
        environmentRating != null && environmentRating.monthKey === currentMonthKey;

    useEffect(() => {
        if (ratedThisMonth) setRatingOpen(false);
    }, [ratedThisMonth]);

    useEffect(() => {
        if (!ratingOpen || ratedThisMonth) return;
        setCourtyard(4);
        setEntrance(4);
        setUkStars(4);
        setFeedbackTags([]);
        setFeedbackOther("");
    }, [ratingOpen, ratedThisMonth]);

    const y = viewMonth.getFullYear();
    const m0 = viewMonth.getMonth();
    const monthPrefix = `${y}-${pad2(m0 + 1)}`;

    useEffect(() => {
        setAgendaOpen(false);
        setDayDetailIso(null);
    }, [monthPrefix]);

    const activitiesThisMonth = useMemo(
        () =>
            calendarActivities
                .filter((a: HouseCalendarActivity) => a.date.startsWith(monthPrefix))
                .sort((a: HouseCalendarActivity, b: HouseCalendarActivity) => a.date.localeCompare(b.date)),
        [monthPrefix, calendarActivities],
    );

    const byDate = useMemo(() => {
        const map = new Map<string, HouseCalendarActivity[]>();
        for (const a of calendarActivities) {
            if (!a.date.startsWith(monthPrefix)) continue;
            const list = map.get(a.date) ?? [];
            list.push(a);
            map.set(a.date, list);
        }
        return map;
    }, [monthPrefix, calendarActivities]);

    const minStars = Math.min(courtyard, entrance, ukStars);
    const needsNegativeDetail = minStars <= 3;

    const toggleFeedbackTag = (id: EnvironmentRatingFeedbackTagId) => {
        setFeedbackTags((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const trySubmitRating = () => {
        if (needsNegativeDetail) {
            const hasTags = feedbackTags.length > 0;
            const hasText = feedbackOther.trim().length >= 3;
            if (!hasTags && !hasText) {
                Alert.alert(
                    "Нужно уточнение",
                    "При оценке 3 звезды или ниже отметьте, что не понравилось, или кратко опишите своими словами.",
                );
                return;
            }
            if (feedbackTags.includes("other") && feedbackOther.trim().length < 3) {
                Alert.alert(
                    "Другое",
                    "Дополните поле «Свой комментарий» хотя бы парой слов.",
                );
                return;
            }
        }
        Alert.alert(
            "Отправить оценку?",
            "После отправки изменить оценку за этот месяц будет нельзя. Оценка собирается раз в месяц — удобнее отправлять её ближе к концу месяца, когда картина яснее.",
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Отправить",
                    onPress: () => {
                        setEnvironmentRating({
                            courtyardStars: courtyard,
                            entranceStars: entrance,
                            ukStars,
                            feedbackTagIds:
                                needsNegativeDetail && feedbackTags.length > 0
                                    ? feedbackTags
                                    : undefined,
                            feedbackOther:
                                needsNegativeDetail && feedbackOther.trim().length > 0
                                    ? feedbackOther.trim()
                                    : undefined,
                        });
                        setRatingOpen(false);
                    },
                },
            ],
        );
    };

    const ratingToggleLabel = ratingOpen ? "Свернуть" : "Добавить оценку";

    return (
        <ScreenLayout
            title="О доме"
            rightAccessory={
                <View style={styles.headerActions}>
                    <NotificationBell />
                    <Pressable
                        onPress={() => navigation.navigate("Profile")}
                        hitSlop={10}
                        style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
                    >
                        <Ionicons name="person-circle-outline" size={30} color={colors.text} />
                    </Pressable>
                </View>
            }
        >
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                nestedScrollEnabled
            >
                {visibleTabs.map((t) => (
                    <Pressable
                        key={t.id}
                        onPress={() => setTab(t.id)}
                        style={[styles.filterChip, tab === t.id && styles.filterChipOn]}
                    >
                        <Text
                            style={[
                                textStyles.caption,
                                tab === t.id ? styles.filterOnText : styles.filterOffText,
                            ]}
                        >
                            {t.label}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            {tab === "calendar" ? (
                <>
                    <Card>
                        <View style={styles.calHeader}>
                            <Pressable
                                onPress={() => setViewMonth((d) => addMonths(d, -1))}
                                hitSlop={10}
                                style={({ pressed }) => [
                                    styles.calNav,
                                    pressed && styles.calNavPressed,
                                ]}
                            >
                                <Ionicons name="chevron-back" size={22} color={colors.text} />
                            </Pressable>
                            <Text style={[textStyles.subtitle, styles.calTitle]}>
                                {monthLabelRu(viewMonth)}
                            </Text>
                            <Pressable
                                onPress={() => setViewMonth((d) => addMonths(d, 1))}
                                hitSlop={10}
                                style={({ pressed }) => [
                                    styles.calNav,
                                    pressed && styles.calNavPressed,
                                ]}
                            >
                                <Ionicons
                                    name="chevron-forward"
                                    size={22}
                                    color={colors.text}
                                />
                            </Pressable>
                        </View>
                        <View style={styles.weekRow}>
                            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((w) => (
                                <Text key={w} style={[textStyles.caption, styles.weekCell]}>
                                    {w}
                                </Text>
                            ))}
                        </View>
                        <MonthGrid
                            y={y}
                            m0={m0}
                            byDate={byDate}
                            onDayPress={(iso) => setDayDetailIso(iso)}
                        />
                        <View style={styles.legend}>
                            {(Object.keys(ACTIVITY_LABEL) as HouseCalendarActivityKind[]).map(
                                (kind) => (
                                    <View key={kind} style={styles.legendRow}>
                                        <View
                                            style={[
                                                styles.legendDot,
                                                { backgroundColor: ACTIVITY_DOT[kind] },
                                            ]}
                                        />
                                        <Text style={[textStyles.caption, styles.legendText]}>
                                            {ACTIVITY_LABEL[kind]}
                                        </Text>
                                    </View>
                                ),
                            )}
                        </View>
                        {activitiesThisMonth.length > 0 ? (
                            <View style={styles.agenda}>
                                <Pressable
                                    onPress={() => setAgendaOpen((o) => !o)}
                                    style={({ pressed }) => [
                                        styles.agendaToggle,
                                        pressed && styles.agendaTogglePressed,
                                    ]}
                                >
                                    <Text style={[textStyles.caption, styles.agendaToggleText]}>
                                        События месяца — подробнее
                                    </Text>
                                    <Ionicons
                                        name={agendaOpen ? "chevron-up" : "chevron-down"}
                                        size={18}
                                        color={colors.textDim}
                                    />
                                </Pressable>
                                {agendaOpen ? (
                                    <View style={styles.agendaList}>
                                        {activitiesThisMonth.map((a, idx) => {
                                            const kind = a.kind as HouseCalendarActivityKind;
                                            const dot = ACTIVITY_DOT[kind];
                                            return (
                                                <React.Fragment key={a.id}>
                                                    {idx > 0 && <AgendaDivider />}
                                                    <View style={[styles.agendaCard, { borderLeftColor: dot }]}>
                                                        <View style={styles.agendaCardTop}>
                                                            <View style={[styles.agendaKindBadge, { backgroundColor: `${dot}22` }]}>
                                                                <Text style={[styles.agendaKindText, { color: dot }]}>
                                                                    {ACTIVITY_LABEL[kind]}
                                                                </Text>
                                                            </View>
                                                            <Text style={styles.agendaDate}>{formatAgendaDate(a.date)}</Text>
                                                        </View>
                                                        <Text style={[textStyles.subtitle, styles.agendaTitle2]}>{a.title}</Text>
                                                    </View>
                                                </React.Fragment>
                                            );
                                        })}
                                    </View>
                                ) : null}
                            </View>
                        ) : (
                            <Text style={[textStyles.caption, styles.agendaEmpty]}>
                                На этот месяц запланированных событий в демо-данных нет.
                            </Text>
                        )}
                    </Card>

                    <DayEventsModal
                        visible={dayDetailIso !== null}
                        isoDate={dayDetailIso}
                        activities={
                            dayDetailIso
                                ? (byDate.get(dayDetailIso) ?? [])
                                      .slice()
                                      .sort((a, b) => a.title.localeCompare(b.title))
                                : []
                        }
                        onClose={() => setDayDetailIso(null)}
                    />
                </>
            ) : null}

            {tab === "passport" ? (
                <>
                    {!buildingInfo ? (
                        <Text style={[textStyles.caption, styles.addr]}>Загрузка данных дома…</Text>
                    ) : (
                        <>
                            <Card style={styles.passportCard} padded>
                                <View style={styles.passportCardTop}>
                                    <View style={styles.passportBadge}>
                                        <Text style={styles.passportBadgeText}>О доме</Text>
                                    </View>
                                </View>
                                <Text style={[textStyles.subtitle, styles.addr]}>
                                    {buildingInfo.address || buildingInfo.shortName}
                                </Text>
                                {buildingInfo.city ? (
                                    <Text style={[textStyles.caption, { color: colors.textDim, marginTop: 2 }]}>
                                        {buildingInfo.city}
                                    </Text>
                                ) : null}
                                <View style={styles.stats}>
                                    <View style={styles.stat}>
                                        <Text style={[textStyles.caption, styles.statLabel]}>Год ввода</Text>
                                        <Text style={[textStyles.title, styles.statVal]}>
                                            {buildingInfo.yearBuilt ?? "—"}
                                        </Text>
                                    </View>
                                    <View style={styles.stat}>
                                        <Text style={[textStyles.caption, styles.statLabel]}>Подъезды</Text>
                                        <Text style={[textStyles.title, styles.statVal]}>
                                            {buildingInfo.entrances ?? "—"}
                                        </Text>
                                    </View>
                                    <View style={styles.stat}>
                                        <Text style={[textStyles.caption, styles.statLabel]}>Квартиры</Text>
                                        <Text style={[textStyles.title, styles.statVal]}>
                                            {buildingInfo.apartments ?? "—"}
                                        </Text>
                                    </View>
                                </View>
                            </Card>

                            {photos.length > 0 && (
                                <>
                                    <PassportDivider />
                                    <Text style={[textStyles.label, styles.sectionFirst]}>Фотографии</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.photos}
                                    >
                                        {photos.map((uri, i) => (
                                            <RNImage key={uri + i} source={{ uri }} style={styles.photo} />
                                        ))}
                                    </ScrollView>
                                </>
                            )}

                            {specs.length > 0 && (
                                <>
                                    <PassportDivider />
                                    <Text style={[textStyles.label, styles.sectionFirst]}>Характеристики</Text>
                                    <Card padded={false}>
                                        {specs.map((row, idx) => (
                                            <View
                                                key={row.label}
                                                style={[
                                                    styles.specRow,
                                                    idx < specs.length - 1 && styles.specBorder,
                                                ]}
                                            >
                                                <Text style={[textStyles.caption, styles.specLabel]}>{row.label}</Text>
                                                <Text style={[textStyles.body, styles.specVal]}>{row.value}</Text>
                                            </View>
                                        ))}
                                    </Card>
                                </>
                            )}
                        </>
                    )}
                </>
            ) : null}

            {tab === "schedule" ? (
                <>
                    <Text style={[textStyles.label, styles.sectionFirst]}>
                        Расписание уборки и вывоза мусора
                    </Text>
                    <View style={styles.scheduleList}>
                        {scheduleItems.map((row, index) => (
                            <React.Fragment key={row.id}>
                                {index > 0 && <ScheduleDivider />}
                                <Card style={styles.trashCard} padded>
                                    <View style={styles.trashHeader}>
                                        <View style={styles.trashBadge}>
                                            <Text style={styles.trashBadgeText}>Расписание</Text>
                                        </View>
                                    </View>
                                    <Text style={[textStyles.subtitle, styles.trashTitle]}>
                                        {row.title}
                                    </Text>
                                    <Text style={[textStyles.body, styles.trashSchedule]}>
                                        {row.schedule}
                                    </Text>
                                    {row.note ? (
                                        <Text style={[textStyles.caption, styles.trashNote]}>
                                            {row.note}
                                        </Text>
                                    ) : null}
                                </Card>
                            </React.Fragment>
                        ))}
                    </View>
                </>
            ) : null}

            {tab === "rating" ? (
                <>
                    <UkPublicStatsCard stats={ukStats} />
                    <View style={styles.ukGap} />
                    <Card>
                        <Text style={[textStyles.caption, styles.ratingHint]}>
                            Раз в календарный месяц вы можете один раз оценить двор, подъезд и работу
                            УК (без привязки к заявке). После отправки изменить оценку за этот месяц
                            нельзя. Удобнее оценивать ближе к концу месяца — так вы учтёте ситуацию за
                            большую часть периода.
                        </Text>
                        {ratedThisMonth && environmentRating ? (
                            <View style={styles.ratingLocked}>
                                <Text style={[textStyles.subtitle, styles.lockedTitle]}>
                                    Оценка за {formatMonthKeyRu(environmentRating.monthKey)}
                                </Text>
                                <Text style={[textStyles.caption, styles.lockedSub]}>
                                    Отправлено{" "}
                                    {new Date(environmentRating.submittedAt).toLocaleString("ru-RU")}
                                </Text>
                                <View style={styles.gapMd} />
                                <StarsSummary label="Двор" value={environmentRating.courtyardStars} />
                                <StarsSummary label="Подъезд" value={environmentRating.entranceStars} />
                                <StarsSummary label="УК" value={environmentRating.ukStars} />
                                {environmentRating.feedbackTagIds &&
                                environmentRating.feedbackTagIds.length > 0 ? (
                                    <View style={styles.lockedFeedback}>
                                        <Text style={[textStyles.caption, styles.lockedFbTitle]}>
                                            Отмечено как неудовлетворительно:
                                        </Text>
                                        {environmentRating.feedbackTagIds.map((id) => (
                                            <Text
                                                key={id}
                                                style={[textStyles.caption, styles.lockedFbRow]}
                                            >
                                                · {feedbackLabel(id)}
                                            </Text>
                                        ))}
                                    </View>
                                ) : null}
                                {environmentRating.feedbackOther ? (
                                    <Text style={[textStyles.caption, styles.lockedOther]}>
                                        Комментарий: {environmentRating.feedbackOther}
                                    </Text>
                                ) : null}
                            </View>
                        ) : (
                            <>
                                <Button
                                    title={ratingToggleLabel}
                                    variant={ratingOpen ? "secondary" : "primary"}
                                    onPress={() => setRatingOpen((o) => !o)}
                                />
                                {ratingOpen ? (
                                    <View style={styles.ratingForm}>
                                        <StarBlock
                                            label="Двор и благоустройство"
                                            value={courtyard}
                                            onChange={setCourtyard}
                                        />
                                        <View style={styles.gapMd} />
                                        <StarBlock
                                            label="Подъезд"
                                            value={entrance}
                                            onChange={setEntrance}
                                        />
                                        <View style={styles.gapMd} />
                                        <StarBlock
                                            label="Работа управляющей компании"
                                            value={ukStars}
                                            onChange={setUkStars}
                                        />
                                        {needsNegativeDetail ? (
                                            <View style={styles.negativeBlock}>
                                                <Text
                                                    style={[textStyles.caption, styles.negativeTitle]}
                                                >
                                                    Если оценка 3 звезды или ниже — отметьте, что не
                                                    понравилось, и/или опишите своими словами:
                                                </Text>
                                                <View style={styles.tagWrap}>
                                                    {FEEDBACK_OPTIONS.map((opt) => {
                                                        const on = feedbackTags.includes(opt.id);
                                                        return (
                                                            <Pressable
                                                                key={opt.id}
                                                                onPress={() =>
                                                                    toggleFeedbackTag(opt.id)
                                                                }
                                                                style={[
                                                                    styles.tagChip,
                                                                    on && styles.tagChipOn,
                                                                ]}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        textStyles.caption,
                                                                        on
                                                                            ? styles.tagChipTextOn
                                                                            : styles.tagChipText,
                                                                    ]}
                                                                >
                                                                    {opt.label}
                                                                </Text>
                                                            </Pressable>
                                                        );
                                                    })}
                                                </View>
                                                <Input
                                                    label="Свой комментарий"
                                                    value={feedbackOther}
                                                    onChangeText={setFeedbackOther}
                                                    multiline
                                                    placeholder="Необязательно, если выбрали пункты выше"
                                                    style={styles.feedbackArea}
                                                />
                                            </View>
                                        ) : null}
                                        <View style={styles.gapMd} />
                                        <Button title="Отправить" onPress={trySubmitRating} />
                                    </View>
                                ) : null}
                            </>
                        )}
                    </Card>
                </>
            ) : null}

        </ScreenLayout>
    );
}

function formatAgendaDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
    });
}

function DayEventsModal({
    visible,
    isoDate,
    activities,
    onClose,
}: {
    visible: boolean;
    isoDate: string | null;
    activities: HouseCalendarActivity[];
    onClose: () => void;
}) {
    const title =
        isoDate != null ? formatDayHeading(isoDate) : "";
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalBackdrop} onPress={onClose}>
                <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.modalHeader}>
                        <Text style={[textStyles.subtitle, styles.modalTitle]}>{title}</Text>
                        <Pressable onPress={onClose} hitSlop={12} style={styles.modalClose}>
                            <Ionicons name="close" size={26} color={colors.text} />
                        </Pressable>
                    </View>
                    <ScrollView
                        style={styles.modalScroll}
                        showsVerticalScrollIndicator={false}
                    >
                        {activities.length === 0 ? (
                            <Text style={[textStyles.body, styles.modalEmpty]}>
                                На эту дату событий не запланировано.
                            </Text>
                        ) : (
                            activities.map((a) => (
                                <View key={a.id} style={styles.modalEvent}>
                                    <View
                                        style={[
                                            styles.modalEventDot,
                                            { backgroundColor: ACTIVITY_DOT[a.kind as HouseCalendarActivityKind] },
                                        ]}
                                    />
                                    <View style={styles.modalEventText}>
                                        <Text style={[textStyles.body, styles.modalEventTitle]}>
                                            {a.title}
                                        </Text>
                                        <Text
                                            style={[textStyles.caption, styles.modalEventKind]}
                                        >
                                            {ACTIVITY_LABEL[a.kind as HouseCalendarActivityKind]}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function formatDayHeading(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

function MonthGrid({
    y,
    m0,
    byDate,
    onDayPress,
}: {
    y: number;
    m0: number;
    byDate: Map<string, HouseCalendarActivity[]>;
    onDayPress: (iso: string) => void;
}) {
    const first = new Date(y, m0, 1);
    const lastDay = new Date(y, m0 + 1, 0).getDate();
    const mondayPad = (first.getDay() + 6) % 7;
    const cells: (null | number)[] = [
        ...Array(mondayPad).fill(null),
        ...Array.from({ length: lastDay }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) {
        cells.push(null);
    }
    return (
        <View style={styles.grid}>
            {cells.map((day, idx) => {
                if (day === null) {
                    return <View key={`e-${idx}`} style={styles.dayCell} />;
                }
                const iso = toIsoDate(y, m0, day);
                const acts = byDate.get(iso) ?? [];
                return (
                    <Pressable
                        key={iso}
                        onPress={() => onDayPress(iso)}
                        style={({ pressed }) => [
                            styles.dayCell,
                            pressed && styles.dayCellPressed,
                        ]}
                    >
                        <Text style={[textStyles.caption, styles.dayNum]}>{day}</Text>
                        <View style={styles.dots}>
                            {acts.slice(0, 3).map((a) => (
                                <View
                                    key={a.id}
                                    style={[
                                        styles.miniDot,
                                        { backgroundColor: ACTIVITY_DOT[a.kind as HouseCalendarActivityKind] },
                                    ]}
                                />
                            ))}
                            {acts.length > 3 ? (
                                <Text style={styles.moreDots}>+</Text>
                            ) : null}
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

function StarsSummary({
    label,
    value,
}: {
    label: string;
    value: 1 | 2 | 3 | 4 | 5;
}) {
    return (
        <View style={styles.starSummaryRow}>
            <Text style={[textStyles.caption, styles.starSummaryLabel]}>{label}</Text>
            <Text style={[textStyles.body, styles.starSummaryVal]}>
                {"★".repeat(value)}
                {"☆".repeat(5 - value)}
            </Text>
        </View>
    );
}

function StarBlock({
    label,
    value,
    onChange,
}: {
    label: string;
    value: 1 | 2 | 3 | 4 | 5;
    onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
    return (
        <View>
            <Text style={[textStyles.caption, styles.starLabel]}>{label}</Text>
            <View style={styles.stars}>
                {STAR_SET.map((n) => (
                    <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
                        <Ionicons
                            name={n <= value ? "star" : "star-outline"}
                            size={28}
                            color={n <= value ? colors.warning : colors.textDim}
                        />
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
    profileButton: { marginTop: spacing.xs },
    profileButtonPressed: { opacity: 0.6 },
    sectionFirst: { color: colors.textMuted, marginTop: 0 },
    section: { color: colors.textMuted, marginTop: spacing.lg },
    filterRow: {
        flexDirection: "row",
        gap: spacing.sm,
        paddingBottom: spacing.md,
        flexGrow: 0,
        alignItems: "center",
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignSelf: "flex-start",
    },
    filterChipOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    filterOnText: { color: colors.primary },
    filterOffText: { color: colors.textMuted },
    addr: { color: colors.text },
    stats: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    stat: {
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        padding: spacing.md,
    },
    statLabel: { color: colors.textDim },
    statVal: { color: colors.primary, marginTop: spacing.xs },
    photos: { gap: spacing.md, paddingVertical: spacing.sm },
    photo: {
        width: 220,
        height: 140,
        borderRadius: radius.lg,
        backgroundColor: colors.border,
    },
    specRow: { padding: spacing.lg },
    specBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
    specLabel: { color: colors.textMuted },
    specVal: { color: colors.text, marginTop: spacing.xs },
    ratingHint: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
    ratingForm: { marginTop: spacing.lg },
    ratingLocked: { marginTop: spacing.md },
    lockedTitle: { color: colors.text },
    lockedSub: { color: colors.textDim, marginTop: spacing.xs },
    starSummaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: spacing.sm,
    },
    starSummaryLabel: { color: colors.textDim },
    starSummaryVal: { color: colors.warning },
    lockedFeedback: { marginTop: spacing.lg },
    lockedFbTitle: { color: colors.textMuted },
    lockedFbRow: { color: colors.text, marginTop: spacing.xs },
    lockedOther: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 20 },
    negativeBlock: { marginTop: spacing.lg },
    negativeTitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    tagChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    tagChipOn: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    tagChipText: { color: colors.textMuted },
    tagChipTextOn: { color: colors.primary },
    feedbackArea: { minHeight: 80, textAlignVertical: "top" },
    starLabel: { color: colors.textDim, marginBottom: spacing.sm },
    stars: { flexDirection: "row", gap: spacing.sm },
    gapMd: { height: spacing.md },
    calHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
    },
    calNav: {
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.bgElevated,
    },
    calNavPressed: { opacity: 0.7 },
    calTitle: { color: colors.text, flex: 1, textAlign: "center" },
    weekRow: { flexDirection: "row", marginBottom: spacing.sm },
    weekCell: {
        flex: 1,
        textAlign: "center",
        color: colors.textDim,
    },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    dayCell: {
        width: `${100 / 7}%`,
        minHeight: 44,
        paddingVertical: spacing.xs,
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
    },
    dayCellPressed: { opacity: 0.75, backgroundColor: colors.primarySoft },
    dayNum: { color: colors.text },
    dots: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        marginTop: 4,
        minHeight: 8,
    },
    miniDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    moreDots: { fontSize: 8, color: colors.textDim },
    legend: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginTop: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
    },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: colors.textDim },
    agenda: { marginTop: spacing.lg },
    agendaToggle: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.bgElevated,
    },
    agendaTogglePressed: { opacity: 0.85 },
    agendaToggleText: { color: colors.text, flex: 1 },
    agendaList: { marginTop: spacing.sm },
    agendaCard: {
        borderLeftWidth: 3,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: 8,
        gap: spacing.xs,
    },
    agendaCardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    agendaKindBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
    },
    agendaKindText: { fontSize: 11, fontWeight: "600" },
    agendaRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    agendaDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
    },
    agendaText: { flex: 1 },
    agendaDate: { color: colors.textDim },
    agendaTitle2: { color: colors.text, marginTop: 2 },
    agendaKind: { color: colors.textDim, marginTop: spacing.xs },
    agendaEmpty: { color: colors.textDim, marginTop: spacing.md },
    modalBackdrop: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: "center",
        padding: spacing.lg,
    },
    modalCard: {
        maxHeight: "70%",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    modalTitle: { color: colors.text, flex: 1, paddingRight: spacing.sm },
    modalClose: { padding: spacing.xs },
    modalScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    modalEmpty: { color: colors.textMuted, paddingVertical: spacing.lg },
    modalEvent: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    modalEventDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 5,
    },
    modalEventText: { flex: 1 },
    modalEventTitle: { color: colors.text },
    modalEventKind: { color: colors.textDim, marginTop: spacing.xs },
    scheduleList: { gap: 0 },
    passportCard: { borderLeftWidth: 3, borderLeftColor: colors.primary, gap: spacing.xs },
    passportCardTop: { marginBottom: spacing.sm },
    passportBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "rgba(61, 158, 122, 0.12)",
    },
    passportBadgeText: { fontSize: 11, fontWeight: "600", color: colors.primary },
    trashCard: { borderLeftWidth: 3, borderLeftColor: colors.info, gap: spacing.xs },
    trashHeader: { marginBottom: spacing.xs },
    trashBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "rgba(91, 159, 212, 0.15)",
    },
    trashBadgeText: { fontSize: 11, fontWeight: "600", color: colors.info },
    divider: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingHorizontal: spacing.lg,
        marginVertical: spacing.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    dividerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginHorizontal: spacing.md,
    },
    trashTitle: { color: colors.text },
    trashSchedule: { color: colors.primary },
    trashNote: { color: colors.textMuted, lineHeight: 18 },
    ukGap: { height: spacing.md },
    ukCard: { borderLeftWidth: 3, borderLeftColor: colors.info, gap: spacing.sm },
    ukCardTop: { marginBottom: spacing.xs },
    ukBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: "rgba(91, 159, 212, 0.15)",
    },
    ukBadgeText: { fontSize: 11, fontWeight: "600", color: colors.info },
    ukName: { color: colors.text },
    ukDetail: { color: colors.textMuted },
});
