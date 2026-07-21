import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";
import * as Localization from "expo-localization";
import ar from "./ar.json";
import en from "./en.json";

export type AppLocale = "en" | "ar";

export const LOCALES: AppLocale[] = ["en", "ar"];

function deviceLocale(): AppLocale {
  const code =
    Localization.getLocales()?.[0]?.languageCode?.toLowerCase() ?? "en";
  return code === "ar" ? "ar" : "en";
}

export function applyRtl(locale: AppLocale) {
  const rtl = locale === "ar";
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

let initialized = false;

export async function initI18n(saved?: string | null) {
  const locale: AppLocale =
    saved === "ar" || saved === "en" ? saved : deviceLocale();

  if (!initialized) {
    await i18n.use(initReactI18next).init({
      compatibilityJSON: "v4",
      resources: {
        en: { translation: en },
        ar: { translation: ar },
      },
      lng: locale,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
    });
    initialized = true;
  } else if (i18n.language !== locale) {
    await i18n.changeLanguage(locale);
  }

  applyRtl(locale);
  return locale;
}

export async function setAppLocale(locale: AppLocale) {
  await i18n.changeLanguage(locale);
  applyRtl(locale);
}

export { deviceLocale };
export default i18n;
