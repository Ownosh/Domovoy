import type { CommunityScreenProps } from "../../navigation/types";
import React, { useMemo } from "react";
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Button, Card, ScreenLayout } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { buildBuildingKey } from "../../utils/buildingKey";
import { voteSourceLine } from "../../utils/voteSponsor";
import { colors, radius, spacing, textStyles } from "../../theme";
import type { NeighborAd, Vote } from "../../types";

type Props = CommunityScreenProps<"CommunityHub">;

const adCatRu: Record<NeighborAd["category"], string> = {
    sell: "Продаю",
    buy: "Ищу",
    lost: "Потеряно",
    found: "Найдено",
    service: "Услуга",
    invite: "Приглашаю",
    other: "Другое",
};

export function CommunityHubScreen({ navigation }: Props) {
    const { profile, neighborAds, votes } = useApp();
    const key = buildBuildingKey(profile.building);

    const ads = useMemo(
        () =>
            neighborAds.filter(
                (a) => a.buildingKey === key && !a.archived,
            ),
        [neighborAds, key],
    );

    const houseVotes = useMemo(
        () => votes.filter((v) => v.buildingKey === key),
        [votes, key],
    );

    return (
        <ScreenLayout
            title="Сообщество"
            subtitle="Объявления соседей и голосования"
            onBack={() => navigation.goBack()}
        >
            <Button
                title="Новое объявление"
                onPress={() =>
                    navigation.navigate("NeighborAdNew", { presetCategory: "sell" })
                }
                variant="secondary"
            />
            <View style={styles.sectionGap} />
            <Text style={[textStyles.label, styles.sectionTitle]}>
                Объявления (отдельно от новостей УК)
            </Text>
            <FlatList
                data={ads}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={
                    <Text style={[textStyles.body, styles.empty]}>
                        Пока нет объявлений. Срок публикации — 30 дней, затем архив.
                    </Text>
                }
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() =>
                            navigation.navigate("NeighborAdDetail", {
                                id: item.id,
                            })
                        }
                    >
                        <Card style={styles.card} padded>
                            <Text style={[textStyles.caption, styles.cat]}>
                                {adCatRu[item.category]}
                                {item.pendingModeration ? " · на проверке УК" : ""}
                            </Text>
                            <Text style={[textStyles.subtitle, styles.adTitle]}>
                                {item.title}
                            </Text>
                            <Text
                                style={[textStyles.caption, styles.adExcerpt]}
                                numberOfLines={2}
                            >
                                {item.body}
                            </Text>
                        </Card>
                    </Pressable>
                )}
                ItemSeparatorComponent={() => (
                    <View style={{ height: spacing.md }} />
                )}
            />

            <View style={styles.sectionGap} />
            <Text style={[textStyles.label, styles.sectionTitle]}>
                Голосования собственников
            </Text>
            <FlatList
                data={houseVotes}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={
                    <Text style={[textStyles.body, styles.empty]}>
                        Нет активных голосований для вашего дома.
                    </Text>
                }
                renderItem={({ item }) => (
                    <VoteRow
                        vote={item}
                        onOpen={() =>
                            navigation.navigate("VoteDetail", { id: item.id })
                        }
                    />
                )}
                ItemSeparatorComponent={() => (
                    <View style={{ height: spacing.md }} />
                )}
            />
        </ScreenLayout>
    );
}

function VoteRow({ vote, onOpen }: { vote: Vote; onOpen: () => void }) {
    const ended =
        vote.closed || new Date(vote.endsAt).getTime() <= Date.now();
    return (
        <Pressable onPress={onOpen}>
            <Card style={styles.card} padded>
                <Text style={[textStyles.caption, styles.cat]}>
                    {voteSourceLine(vote)} · {ended ? "Завершено" : "Идёт"} ·{" "}
                    {vote.visibility === "open" ? "открытое" : "тайное"}
                </Text>
                <Text style={[textStyles.subtitle, styles.adTitle]}>
                    {vote.topic}
                </Text>
                <Text style={[textStyles.caption, styles.adExcerpt]}>
                    {vote.createdByLabel}
                </Text>
            </Card>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    sectionGap: { height: spacing.lg },
    sectionTitle: { color: colors.textMuted, marginBottom: spacing.sm },
    card: { gap: spacing.xs },
    cat: { color: colors.textDim },
    adTitle: { color: colors.text },
    adExcerpt: { color: colors.textMuted },
    empty: { color: colors.textMuted, paddingVertical: spacing.md },
});
