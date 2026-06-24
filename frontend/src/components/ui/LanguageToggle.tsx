import { useTranslation } from 'react-i18next'

/** 中英语言切换按钮。点击在 en/zh 间切换并持久化到 localStorage。 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language?.startsWith('zh')
  const next = isZh ? 'en' : 'zh'

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(next)}
      aria-label="Switch language"
      className={`text-xs text-gray-500 border border-gray-200 rounded-full px-2.5 py-1 hover:bg-gray-50 transition-colors ${className}`}
    >
      {isZh ? 'EN' : '中文'}
    </button>
  )
}
