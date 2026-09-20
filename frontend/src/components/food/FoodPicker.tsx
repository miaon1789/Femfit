import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchFoodDatabase, type FoodDbItem } from '@/lib/foodSearch'
import { authedFetch } from '@/lib/api'
import type { useFoodLibrary } from '@/hooks/useFoodLibrary'

type Source = 'library' | 'recent' | 'favorites' | 'usda' | 'barcode'
export function FoodPicker({ library, onSelect, onManual, onAI }: {
  library: ReturnType<typeof useFoodLibrary>; onSelect: (food: FoodDbItem) => void
  onManual: (name: string) => void; onAI?: () => void
}) {
  const { t, i18n } = useTranslation()
  const [source, setSource] = useState<Source>('recent')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodDbItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const generation = useRef(0)
  const remote = source === 'usda' || source === 'barcode'
  useEffect(() => {
    const id = ++generation.current
    setResults([]); setLoading(false); setError(''); setSearched(false)
    if (source !== 'library' || !query.trim()) return () => { ++generation.current }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const foods = await searchFoodDatabase(query)
        if (generation.current === id) { setResults(foods); setSearched(true) }
      } catch { if (generation.current === id) setError('food.searchError') }
      finally { if (generation.current === id) setLoading(false) }
    }, 250)
    return () => { clearTimeout(timer); ++generation.current }
  }, [query, source])
  const searchExternal = async () => {
    const id = ++generation.current
    setLoading(true); setError(''); setResults([]); setSearched(false)
    try {
      const response = await authedFetch(`/api/foods/search?source=${source}&q=${encodeURIComponent(query.trim())}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      if (generation.current === id) { setResults(body.foods); setSearched(true) }
    } catch (e) {
      if (generation.current === id) setError(e instanceof Error && e.message === 'source_not_configured' ? 'food.sourceNotConfigured' : 'food.searchError')
    } finally { if (generation.current === id) setLoading(false) }
  }
  const list = source === 'recent' ? library.recent : source === 'favorites' ? library.favorites : results
  const visible = source === 'recent' || source === 'favorites'
    ? list.filter(f => f.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : list
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('food.searchDb')}>
      {(['recent', 'favorites', 'library', 'barcode', 'usda'] as Source[]).map(s => <button key={s} type="button"
        aria-pressed={source === s} onClick={() => { if (s !== source) { ++generation.current; setSource(s) } }}
        className={`shrink-0 px-3 py-2 rounded-xl text-xs ${source === s ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500'}`}>{t(`food.source_${s}`)}</button>)}
    </div>
    <input aria-label={t('food.searchDb')} value={query} maxLength={120}
      placeholder={t(source === 'barcode' ? 'food.barcodeHint' : source === 'usda' ? 'food.usdaHint' : 'food.searchPlaceholder')}
      onChange={e => { ++generation.current; setQuery(e.target.value) }}
      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
    {remote && <button type="button" disabled={loading || !query.trim()} onClick={searchExternal}
      className="text-sm text-primary-600 disabled:opacity-50">{t('food.searchButton')}</button>}
    {(loading || ((source === 'recent' || source === 'favorites') && library.loading)) && <p role="status" className="text-sm text-gray-400">{t('food.searching')}</p>}
    {(error || ((source === 'recent' || source === 'favorites') && library.error)) && <p role="alert" className="text-sm text-red-500">{t(error || 'food.searchError')}</p>}
    <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
      {visible.map((item, index) => <div key={item.id ?? `${item.name}:${index}`} className="flex items-center gap-2 py-2">
        <button type="button" className="flex-1 text-left text-sm" onClick={() => onSelect(item)}>
          <span className="block text-gray-800">{i18n.language.startsWith('zh') ? item.name : item.name_en || item.name}</span>
          <span className="text-xs text-gray-400">{item.serving_size} {item.serving_unit} · {item.calories} kcal{item.source ? ` · ${item.source}` : ''}</span>
          {item.serving_description && <span className="block text-xs text-gray-400">{item.serving_description}</span>}
        </button>
        {source === 'favorites' && item.id && <button type="button" aria-label={t('food.removeFavorite')} className="text-gray-400"
          onClick={async () => { try { await library.remove(item.id!) } catch { setError('food.saveFailed') } }}>×</button>}
      </div>)}
    </div>
    {!loading && !error && !library.loading && !visible.length && (searched || source === 'recent' || source === 'favorites') &&
      <p className="text-sm text-gray-400">{t('food.noResults')}</p>}
    <div className="flex gap-4 text-xs text-primary-600">
      <button type="button" onClick={() => onManual(query)}>{t('food.manualCreate')}</button>
      {onAI && <button type="button" onClick={onAI}>{t('food.aiEstimate')}</button>}
    </div>
    {source === 'barcode' && <a className="block text-xs text-gray-400 underline" href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts · ODbL</a>}
  </div>
}
