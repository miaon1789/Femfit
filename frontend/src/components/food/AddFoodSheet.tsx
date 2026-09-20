import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { FoodDbItem } from '@/lib/foodSearch'
import { FoodPicker } from './FoodPicker'
import { useFoodLibrary } from '@/hooks/useFoodLibrary'
import { portionFactor } from '@/lib/foodPortions'
import type { MealType } from '@/types'
import type { AddFoodPayload } from '@/hooks/useFoodLogs'

const MEAL_KEY: Record<MealType, string> = {
  breakfast: 'food.mealBreakfast', lunch: 'food.mealLunch',
  dinner: 'food.mealDinner', snack: 'food.mealSnack',
}

const UNITS = ['g', 'ml', '个', '份', '碗', '片', '杯', '勺']

interface AddFoodSheetProps {
  mealType: MealType
  onClose: () => void
  onAI?: () => void
  onSave: (payload: AddFoodPayload) => Promise<void>
}

/** 选中食物库条目后，用于按份量等比缩放的基准值 */
interface ScaleBase {
  unit: string
  qty: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function AddFoodSheet({ mealType, onClose, onSave, onAI }: AddFoodSheetProps) {
  const { t, i18n } = useTranslation()
  const displayName = (item: FoodDbItem) =>
    i18n.language.startsWith('zh') ? item.name : item.name_en || item.name
  const [foodName, setFoodName] = useState('')
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [showMacros, setShowMacros] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const library = useFoodLibrary()
  const [base, setBase] = useState<ScaleBase | null>(null)
  const [conversion, setConversion] = useState('')
  const [sourceFood, setSourceFood] = useState<FoodDbItem | null>(null)
  const [favoriteSaving, setFavoriteSaving] = useState(false)
  const [favoriteSaved, setFavoriteSaved] = useState(false)

  // 禁止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const selectFood = (item: FoodDbItem) => {
    setSourceFood(item)
    setConversion('')
    setFavoriteSaved(false)
    setFoodName(displayName(item))
    setQuantity(String(item.serving_size))
    setUnit(item.serving_unit)
    setCalories(String(item.calories))
    setProtein(String(item.protein_g))
    setCarbs(String(item.carbs_g))
    setFat(String(item.fat_g))
    setShowMacros(true)
    setBase({
      unit: item.serving_unit,
      qty: Number(item.serving_size),
      calories: item.calories,
      protein: item.protein_g,
      carbs: item.carbs_g,
      fat: item.fat_g,
    })

  }

  const factor = base ? portionFactor(Number(quantity), unit, base.qty, base.unit, Number(conversion)) : null
  useEffect(() => {
    if (!base || factor === null) return
    setCalories(String(Math.round(base.calories * factor)))
    setProtein(String(round1(base.protein * factor)))
    setCarbs(String(round1(base.carbs * factor)))
    setFat(String(round1(base.fat * factor)))
  }, [base, factor])
  useEffect(() => { setFavoriteSaved(false) }, [foodName, quantity, unit, calories, protein, carbs, fat])
  const handleQuantityChange = (val: string) => { setQuantity(val); setFavoriteSaved(false) }
  const valid = () => {
    if (!foodName.trim()) { setError(t('food.errFoodName')); return false }
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) { setError(t('food.errQuantity')); return false }
    if (base && factor === null) { setError(t('food.conversionRequired')); return false }
    if (!calories.trim() || [calories, protein, carbs, fat].some(v => !Number.isFinite(Number(v)) || Number(v) < 0)) {
      setError(t('food.errCalories')); return false
    }
    return true
  }
  const saveFavorite = async () => {
    setError('')
    if (!valid()) return
    setFavoriteSaving(true)
    try {
      await library.save({ name: foodName.trim(), name_en: null, category: '自定义',
        serving_size: Number(quantity), serving_unit: unit, calories: Number(calories),
        protein_g: Number(protein), carbs_g: Number(carbs), fat_g: Number(fat), fiber_g: 0, iron_mg: 0,
        source: sourceFood?.source, source_url: sourceFood?.source_url })
      setFavoriteSaved(true)
    } catch { setError(t('food.saveFailed')) }
    finally { setFavoriteSaving(false) }
  }

  const handleSave = async () => {
    setError('')
    if (!valid()) return

    setLoading(true)
    try {
      await onSave({
        food_name: foodName.trim(),
        quantity: parseFloat(quantity),
        unit,
        calories: parseFloat(calories),
        protein_g: protein ? parseFloat(protein) : 0,
        carbs_g: carbs ? parseFloat(carbs) : 0,
        fat_g: fat ? parseFloat(fat) : 0,
      })
      onClose()
    } catch {
      setError(t('food.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* 底部抽屉 */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl max-h-[85vh] overflow-y-auto">
        {/* 拖拽条 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">
              {t('food.addTo', { meal: t(MEAL_KEY[mealType]) })}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 text-xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          <FoodPicker library={library} onSelect={selectFood} onAI={onAI} onManual={name => {
            setFoodName(name); setBase(null); setSourceFood(null); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setFavoriteSaved(false)
          }} />
          {sourceFood?.source && <p className="text-xs text-gray-400">{t('food.externalNote')}</p>}
          {sourceFood?.category === '外食' && <p className="text-xs text-gray-400">{t('food.recipeEstimate')}</p>}
          {sourceFood?.source_url && <a href={sourceFood.source_url} target="_blank" rel="noreferrer" className="block text-xs text-primary-600 underline">{sourceFood.source}</a>}

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-300">{t('food.orManual')}</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* 食物名称 */}
          <Input
            label={t('food.foodName')}
            placeholder={t('food.foodNamePlaceholder')}
            value={foodName}
            onChange={(e) => { setFoodName(e.target.value); setBase(null) }}
          />

          {/* 数量 + 单位 */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">{t('food.quantity')}</p>
            <div className="flex gap-2">
              <div className="w-24 shrink-0">
                <Input
                  type="number"
                  placeholder="100"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1 flex gap-1 overflow-x-auto">
                {Array.from(new Set([...UNITS, unit])).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => { setUnit(u); setConversion(''); setFavoriteSaved(false) }}
                    className={`shrink-0 px-3 py-2 rounded-xl text-sm border-2 transition-all ${
                      unit === u
                        ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium'
                        : 'border-gray-100 text-gray-500'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {base && unit !== base.unit && <Input label={t('food.portionConversion', { unit, baseUnit: base.unit })}
              type="number" value={conversion} onChange={e => setConversion(e.target.value)} placeholder="150" />}
            {base && (
              <p className="text-xs text-gray-400">{t('food.scaledNote')}</p>
            )}
          </div>

          {/* 热量 */}
          <Input
            label={t('food.calories')}
            type="number"
            placeholder={t('food.caloriesPlaceholder')}
            suffix="kcal"
            value={calories}
            onChange={(e) => { setCalories(e.target.value); setBase(null) }}
          />

          {/* 营养素（可选展开） */}
          <button
            type="button"
            onClick={() => setShowMacros((v) => !v)}
            className="text-sm text-primary-500 flex items-center gap-1"
          >
            <span>{showMacros ? '▾' : '▸'}</span>
            {showMacros ? t('food.hideMacros') : t('food.addMacros')}
          </button>

          {showMacros && (
            <div className="grid grid-cols-3 gap-3">
              <Input
                label={t('food.protein')}
                type="number"
                placeholder="0"
                suffix="g"
                value={protein}
                onChange={(e) => { setProtein(e.target.value); setBase(null) }}
              />
              <Input
                label={t('food.carbs')}
                type="number"
                placeholder="0"
                suffix="g"
                value={carbs}
                onChange={(e) => { setCarbs(e.target.value); setBase(null) }}
              />
              <Input
                label={t('food.fat')}
                type="number"
                placeholder="0"
                suffix="g"
                value={fat}
                onChange={(e) => { setFat(e.target.value); setBase(null) }}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-2 text-center">
              {error}
            </p>
          )}

          <Button fullWidth variant="outline" loading={favoriteSaving} disabled={favoriteSaved} onClick={saveFavorite}>
            {t(favoriteSaved ? 'food.favoriteSaved' : 'food.saveFavorite')}
          </Button>
          <Button fullWidth loading={loading} onClick={handleSave}>
            {t('food.save')}
          </Button>
        </div>
      </div>
    </>
  )
}
