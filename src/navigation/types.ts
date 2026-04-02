import type { NativeStackScreenProps } from "@react-navigation/native-stack";
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
};

export type AppealsStackParamList = {
    AppealsList: undefined;
    AppealNew: undefined;
    AppealDetail: { id: string };
};

export type ProfileStackParamList = {
    ProfileMain: undefined;
    EditProfile: undefined;
    ChangePassword: undefined;
    Verification: undefined;
    DeleteAccount: undefined;
    AppealHistory: undefined;
    NotificationSettings: undefined;
    Contacts: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Appeals: NavigatorScreenParams<AppealsStackParamList> | undefined;
    House: undefined;
    District: undefined;
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
    NativeStackScreenProps<RootStackParamList>
>;

export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
