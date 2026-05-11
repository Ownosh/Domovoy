import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenLayout } from "../../components/ui";
import type {
    AuthStackParamList,
    ProfileStackParamList,
} from "../../navigation/types";
import { colors, spacing, textStyles } from "../../theme";

type Props = NativeStackScreenProps<
    AuthStackParamList & ProfileStackParamList,
    "PrivacyPolicy"
>;

export function PrivacyPolicyScreen({ navigation }: Props) {
    return (
        <ScreenLayout
            title="Политика конфиденциальности"
            subtitle="Обработка персональных данных"
            onBack={() => navigation.goBack()}
        >
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator
            >
                <Text style={[textStyles.body, styles.p]}>
                    Настоящая политика описывает порядок обработки персональных данных
                    при использовании мобильного приложения «Домовой» (далее —
                    Приложение).
                </Text>
                <Text style={[textStyles.subtitle, styles.h]}>
                    1. Какие данные обрабатываются
                </Text>
                <Text style={[textStyles.body, styles.p]}>
                    Для регистрации и работы личного кабинета обрабатываются: фамилия,
                    имя, отчество (ФИО), адрес электронной почты, номер телефона, адрес
                    дома и номер квартиры. Дополнительно могут обрабатываться данные,
                    которые вы указываете в обращениях, объявлениях и при прохождении
                    верификации (в объёме, необходимом для целей обработки).
                </Text>
                <Text style={[textStyles.subtitle, styles.h]}>
                    2. Цели обработки
                </Text>
                <Text style={[textStyles.body, styles.p]}>
                    Данные используются для идентификации пользователя, связи по вопросам
                    обслуживания дома, направления уведомлений, ведения обращений в
                    управляющую компанию, организации голосований собственников и
                    функций сообщества жильцов в рамках вашего дома.
                </Text>
                <Text style={[textStyles.subtitle, styles.h]}>
                    3. Срок хранения и права субъекта
                </Text>
                <Text style={[textStyles.body, styles.p]}>
                    Данные хранятся в течение срока использования аккаунта и срока,
                    установленного законодательством РФ. Вы вправе запросить уточнение,
                    блокирование или удаление данных в пределах, допускаемых законом,
                    обратившись в УК через контакты, указанные в Приложении.
                </Text>
                <Text style={[textStyles.caption, styles.note]}>
                    Текст носит ознакомительный характер. Перед запуском продукта
                    согласуйте политику с юристом.
                </Text>
                <View style={styles.bottomSpacer} />
            </ScrollView>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingBottom: spacing.xxxl },
    h: { color: colors.text, marginTop: spacing.lg },
    p: { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
    note: { color: colors.textDim, marginTop: spacing.xl },
    bottomSpacer: { height: spacing.xxxl },
});
