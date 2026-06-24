import dayjs from 'dayjs'

/** 本地化日期格式：中文用「年月日」，英文用「MMM D, YYYY」。 */
export function formatDateLong(date: dayjs.ConfigType, lang: string): string {
  return lang.startsWith('zh')
    ? dayjs(date).format('YYYY年MM月DD日')
    : dayjs(date).format('MMM D, YYYY')
}

/** 本地化短日期：中文「MM月DD日」，英文「MMM D」。 */
export function formatDateShort(date: dayjs.ConfigType, lang: string): string {
  return lang.startsWith('zh')
    ? dayjs(date).format('MM月DD日')
    : dayjs(date).format('MMM D')
}
