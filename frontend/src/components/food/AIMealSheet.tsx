import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { analyzeMeal, type AIAnalyzedFood } from '@/lib/api'
import type { MealType } from '@/types'
import type { AddFoodPayload } from '@/hooks/useFoodLogs'

const MEAL_KEY: Record<MealType, string> = {
  breakfast: 'food.mealBreakfast', lunch: 'food.mealLunch',
  dinner: 'food.mealDinner', snack: 'food.mealSnack',
}
const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

interface AIMealSheetProps {
  date: string
  defaultMeal: MealType
  onClose: () => void
  onSave: (mealType: MealType, foods: AddFoodPayload[]) => Promise<void>
}

export function AIMealSheet({ date, defaultMeal, onClose, onSave }: AIMealSheetProps) {
  const { t, i18n } = useTranslation()
  const [mealType, setMealType] = useState<MealType>(defaultMeal)
  const [description, setDescription] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [foods, setFoods] = useState<AIAnalyzedFood[] | null>(null)
  const [cycleTip, setCycleTip] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleAnalyze = async () => {
    setError('')
    if (!description.trim()) { setError(t('food.errDescribe')); return }
    setAnalyzing(true)
    try {
      const res = await analyzeMeal({
        description: description.trim(),
        meal_type: mealType,
        date,
        locale: i18n.language.startsWith('zh') ? 'zh' : 'en',
      })
      setFoods(res.foods ?? [])
      setCycleTip(res.cycle_tip ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('food.aiFailed'))
    } finally {
      setAnalyzing(false)
    }
  }

  const removeFood = (idx: number) =>
    setFoods((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev))

  const handleSave = async () => {
    if (!foods || foods.length === 0) return
    setSaving(true)
    setError('')
    try {
      const payloads: AddFoodPayload[] = foods.map((f) => ({
        food_name: f.food_name,
        quantity: f.quantity,
        unit: f.unit,
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
      }))
      await onSave(mealType, payloads)
      onClose()
    } catch {
      setError(t('food.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const total = foods?.reduce((s, f) => s + Number(f.calories), 0) ?? 0

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl max-h-[88vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">{t('food.aiTitle')}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 text-xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* 餐次选择 */}
          <div className="flex gap-2">
            {MEALS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMealType(m)}
                className={`flex-1 py-2 rounded-xl text-sm border-2 transition-all ${
                  mealType === m
                    ? 'border-primary-400 bg-primary-50 text-primary-600 font-medium'
                    : 'border-gray-100 text-gray-500'
                }`}
              >
                {t(MEAL_KEY[m])}
              </button>
            ))}
          </div>

          {/* 自然语言输入 */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">{t('food.describeMeal')}</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('food.aiPlaceholder')}
              rows={3}
              autoFocus
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-primary-400 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-2 text-center">
              {error}
            </p>
          )}

          {/* 识别结果 */}
          {foods && foods.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{t('food.result')}</p>
                <span className="text-sm text-primary-500 font-medium">{Math.round(total)} kcal</span>
              </div>
              <div className="border border-gray-100 rounded-2xl divide-y divide-gray-50 overflow-hidden">
                {foods.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{f.food_name}</p>
                      <p className="text-xs text-gray-400">
                        {f.quantity}{f.unit} · {Math.round(f.calories)} kcal · {t('food.protein')} {Math.round(f.protein_g)}g
                      </p>
                    </div>
                    <button
                      onClick={() => removeFood(idx)}
                      className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {cycleTip && (
                <p className="text-xs text-primary-600 bg-primary-50 rounded-2xl px-4 py-2.5 leading-relaxed">
                  🌸 {cycleTip}
                </p>
              )}
            </div>
          )}

          {foods && foods.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">{t('food.noFoodsFound')}</p>
          )}

          {/* 操作按钮 */}
          {foods ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setFoods(null); setCycleTip('') }}>
                {t('food.reanalyze')}
              </Button>
              <Button fullWidth loading={saving} onClick={handleSave} disabled={foods.length === 0}>
                {t('food.saveAll')}
              </Button>
            </div>
          ) : (
            <Button fullWidth loading={analyzing} onClick={handleAnalyze}>
              {analyzing ? t('food.aiAnalyzing') : t('food.aiRecognize')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
