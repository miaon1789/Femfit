import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { searchFoodDatabase, FOOD_CATEGORY_KEY, type FoodDbItem } from '@/lib/foodSearch'
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
  onSave: (payload: AddFoodPayload) => Promise<void>
}

/** 选中食物库条目后，用于按份量等比缩放的基准值 */
interface ScaleBase {
  qty: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function AddFoodSheet({ mealType, onClose, onSave }: AddFoodSheetProps) {
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

  // 食物库搜索
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodDbItem[]>([])
  const [searching, setSearching] = useState(false)
  const [base, setBase] = useState<ScaleBase | null>(null)

  // 禁止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // 搜索（轻量防抖）
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      const r = await searchFoodDatabase(q)
      setResults(r)
      setSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const selectFood = (item: FoodDbItem) => {
    setFoodName(displayName(item))
    setQuantity(String(item.serving_size))
    setUnit(item.serving_unit)
    setCalories(String(item.calories))
    setProtein(String(item.protein_g))
    setCarbs(String(item.carbs_g))
    setFat(String(item.fat_g))
    setShowMacros(true)
    setBase({
      qty: item.serving_size,
      calories: item.calories,
      protein: item.protein_g,
      carbs: item.carbs_g,
      fat: item.fat_g,
    })
    setQuery('')
    setResults([])
  }

  // 份量变化时，若来自食物库则等比缩放营养值
  const handleQuantityChange = (val: string) => {
    setQuantity(val)
    const qty = parseFloat(val)
    if (base && base.qty > 0 && qty > 0) {
      const f = qty / base.qty
      setCalories(String(Math.round(base.calories * f)))
      setProtein(String(round1(base.protein * f)))
      setCarbs(String(round1(base.carbs * f)))
      setFat(String(round1(base.fat * f)))
    }
  }

  const handleSave = async () => {
    setError('')
    if (!foodName.trim()) { setError(t('food.errFoodName')); return }
    if (!quantity || parseFloat(quantity) <= 0) { setError(t('food.errQuantity')); return }
    if (!calories || parseFloat(calories) < 0) { setError(t('food.errCalories')); return }

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

          {/* 食物库搜索 */}
          <div className="space-y-1.5">
            <Input
              label={t('food.searchDb')}
              placeholder={t('food.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {(searching || results.length > 0) && (
              <div className="border border-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
                {searching && (
                  <div className="px-4 py-3 text-sm text-gray-400">{t('food.searching')}</div>
                )}
                {results.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => selectFood(item)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-primary-50 active:bg-primary-100 transition-colors"
                  >
                    <div>
                      <p className="text-sm text-gray-800">{displayName(item)}</p>
                      <p className="text-xs text-gray-400">
                        {t('food.perServing', {
                          category: FOOD_CATEGORY_KEY[item.category] ? t(FOOD_CATEGORY_KEY[item.category]) : item.category,
                          size: item.serving_size,
                          unit: item.serving_unit,
                        })}
                      </p>
                    </div>
                    <span className="text-sm text-primary-500 font-medium shrink-0 ml-2">
                      {item.calories} kcal
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="100"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                />
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
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
                onChange={(e) => setProtein(e.target.value)}
              />
              <Input
                label={t('food.carbs')}
                type="number"
                placeholder="0"
                suffix="g"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
              <Input
                label={t('food.fat')}
                type="number"
                placeholder="0"
                suffix="g"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-2 text-center">
              {error}
            </p>
          )}

          <Button fullWidth loading={loading} onClick={handleSave}>
            {t('food.save')}
          </Button>
        </div>
      </div>
    </>
  )
}
