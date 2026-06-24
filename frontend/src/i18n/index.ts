import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import zh from './locales/zh.json'

export const SUPPORTED_LANGS = ['en', 'zh'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    // 默认英文（面向澳洲招聘方）；用户切换后存 localStorage 持久化。
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'femfit-lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
