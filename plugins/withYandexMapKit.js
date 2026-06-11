const { withAppDelegate } = require("expo/config-plugins");

/**
 * Initializes Yandex MapKit on iOS by patching AppDelegate, since
 * react-native-yamap requires a native [YMKMapKit setApiKey:] call
 * before the map view is used (the JS-side YaMap.init() call only
 * covers Android).
 */
const withYandexMapKit = (config, { apiKey }) => {
    return withAppDelegate(config, (config) => {
        const mod = config.modResults;

        if (mod.language === "swift") {
            if (!mod.contents.includes("import YandexMapsMobile")) {
                mod.contents = mod.contents.replace(
                    /(import Expo\n)/,
                    `$1import YandexMapsMobile\n`,
                );
            }

            const initLines =
                `    YMKMapKit.setApiKey("${apiKey}")\n` +
                `    YMKMapKit.setLocale("ru_RU")\n` +
                `    _ = YMKMapKit.sharedInstance()\n\n`;

            if (!mod.contents.includes("YMKMapKit.setApiKey")) {
                if (mod.contents.includes("return super.application(application, didFinishLaunchingWithOptions: launchOptions)")) {
                    mod.contents = mod.contents.replace(
                        "return super.application(application, didFinishLaunchingWithOptions: launchOptions)",
                        `${initLines}    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`,
                    );
                } else if (mod.contents.includes("return true")) {
                    mod.contents = mod.contents.replace(
                        "return true",
                        `${initLines}    return true`,
                    );
                }
            }
        } else {
            if (!mod.contents.includes("#import <YandexMapsMobile/YMKMapKitFactory.h>")) {
                mod.contents = mod.contents.replace(
                    /#import "AppDelegate\.h"/,
                    `#import "AppDelegate.h"\n#import <YandexMapsMobile/YMKMapKitFactory.h>`,
                );
            }

            const initLines =
                `\t[YMKMapKit setApiKey:@"${apiKey}"];\n` +
                `\t[YMKMapKit setLocale:@"ru_RU"];\n` +
                `\t[YMKMapKit mapKit];\n\n`;

            if (!mod.contents.includes("[YMKMapKit setApiKey")) {
                if (mod.contents.includes("return [super application:application didFinishLaunchingWithOptions:launchOptions];")) {
                    mod.contents = mod.contents.replace(
                        "return [super application:application didFinishLaunchingWithOptions:launchOptions];",
                        `${initLines}\treturn [super application:application didFinishLaunchingWithOptions:launchOptions];`,
                    );
                } else if (mod.contents.includes("return YES;")) {
                    mod.contents = mod.contents.replace(
                        "return YES;",
                        `${initLines}\treturn YES;`,
                    );
                }
            }
        }

        return config;
    });
};

module.exports = withYandexMapKit;
