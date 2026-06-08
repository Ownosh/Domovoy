import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EmergencyScenarioId, NeighborAdCategory } from "../types";
import type {
    BottomTabNavigationProp,
    BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";
import type {
    CompositeScreenProps,
    NavigatorScreenParams,
} from "@react-navigation/native";

export type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    PrivacyPolicy: undefined;
};

export type CommunityStackParamList = {
    NeighborAdNew: { presetCategory?: NeighborAdCategory; editId?: string } | undefined;
    NeighborAdDetail: { id: string };
    VoteDetail: { id: string };
    VoteCreateInfo: undefined;
    VoteNew: { editId?: string } | undefined;
    AppealDetail: { id: string };
    AppealNew: { defaultKind?: "personal" | "collective"; editId?: string } | undefined;
};

export type AuthenticatedRootParamList = {
    Main: undefined;
    Community: NavigatorScreenParams<CommunityStackParamList> | undefined;
    Sos: undefined;
    NewsDetail: { newsId: string };
};

export type SafetyStackParamList = {
    SafetyHub: undefined;
    EmergencyPhones: undefined;
    EmergencyGuide: undefined;
    EmergencyGuideDetail: { scenario: EmergencyScenarioId };
    RightsResidents: undefined;
    RightsUk: undefined;
};

export type SafetyScreenProps<T extends keyof SafetyStackParamList> =
    NativeStackScreenProps<SafetyStackParamList, T>;

export type CommunityScreenProps<T extends keyof CommunityStackParamList> =
    NativeStackScreenProps<CommunityStackParamList, T>;

export type AppealsStackParamList = {
    AppealsList: undefined;
    AppealNew: { defaultKind?: "personal" | "collective"; editId?: string } | undefined;
    AppealDetail: { id: string };
    NeighborAdNew: { presetCategory?: NeighborAdCategory; editId?: string } | undefined;
    NeighborAdDetail: { id: string };
    VoteDetail: { id: string };
    VoteCreateInfo: undefined;
    VoteNew: { editId?: string } | undefined;
};

export type ProfileStackParamList = {
    ProfileMain: undefined;
    EditProfile: undefined;
    ChangePassword: undefined;
    Verification: undefined;
    PrivacyPolicy: undefined;
    DeleteAccount: undefined;
    AppealHistory: undefined;
    AppealHistoryDetail: { id: string };
    NotificationSettings: undefined;
    Contacts: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Appeals: NavigatorScreenParams<AppealsStackParamList> | undefined;
    AboutHouse: undefined;
    District: undefined;
    Safety: NavigatorScreenParams<SafetyStackParamList> | undefined;
    Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
};

export type AppealsScreenProps<T extends keyof AppealsStackParamList> =
    NativeStackScreenProps<AppealsStackParamList, T>;

export type ProfileScreenProps<T extends keyof ProfileStackParamList> =
    NativeStackScreenProps<ProfileStackParamList, T>;

export type HomeTabProps = CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, "Home">,
    NativeStackScreenProps<AuthenticatedRootParamList>
>;

export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
