import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { analyzeMeal, getMealAnalysisErrorKey, type AIAnalyzedFood } from '@/lib/api'
import type { MealType } from '@/types'
import type { AddFoodPayload } from '@/hooks/useFoodLogs'
import { MealPhotoError, prepareMealPhoto } from '@/lib/mealPhoto'

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
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof prepareMealPhoto>> | null>(null)
  const [preparingPhoto, setPreparingPhoto] = useState(false)
  const galleryInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const photoVersion = useRef(0)
  const analysisController = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const busy = preparingPhoto || analyzing || saving

  const clearResult = () => { setFoods(null); setCycleTip(''); setError('') }

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const version = ++photoVersion.current
    clearResult()
    setPhoto(null)
    setPreparingPhoto(true)
    try {
      const prepared = await prepareMealPhoto(file)
      if (mounted.current && version === photoVersion.current) setPhoto(prepared)
    } catch (cause) {
      if (mounted.current && version === photoVersion.current) {
        setError(t(cause instanceof MealPhotoError ? cause.message : 'food.photoFailed'))
      }
    } finally {
      if (mounted.current && version === photoVersion.current) setPreparingPhoto(false)
    }
  }

  const removePhoto = () => {
    photoVersion.current++
    setPhoto(null)
    setPreparingPhoto(false)
    clearResult()
  }

  useEffect(() => {
    mounted.current = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      mounted.current = false
      photoVersion.current++
      analysisController.current?.abort()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const handleAnalyze = async () => {
    setError('')
    if (busy) return
    if (!description.trim() && !photo) { setError(t('food.errDescribe')); return }
    setAnalyzing(true)
    const controller = new AbortController()
    analysisController.current = controller
    const timeout = setTimeout(() => controller.abort(), 90_000)
    try {
      const res = await analyzeMeal({
        description: description.trim(),
        image: photo?.image,
        meal_type: mealType,
        date,
        locale: i18n.language.startsWith('zh') ? 'zh' : 'en',
      }, controller.signal)
      if (!mounted.current) return
      setFoods(res.foods ?? [])
      setCycleTip(res.cycle_tip ?? '')
    } catch (e) {
      if (mounted.current) setError(t(getMealAnalysisErrorKey(e)))
    } finally {
      clearTimeout(timeout)
      if (mounted.current) setAnalyzing(false)
    }
  }

  const removeFood = (idx: number) =>
    setFoods((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev))

  const handleSave = async () => {
    if (!foods || foods.length === 0 || saving) return
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
      if (mounted.current) onClose()
    } catch {
      if (mounted.current) setError(t('food.saveFailed'))
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  const total = foods?.reduce((s, f) => s + Number(f.calories), 0) ?? 0

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-label={t('food.aiTitle')} className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl max-h-[88vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">{t('food.aiTitle')}</h3>
            <button
              aria-label={t('food.closeAnalysis')}
              onClick={onClose}
              className="text-gray-400 text-xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
            {/* Meal selection */}
            <div className="flex gap-2">
              {MEALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMealType(m); clearResult() }}
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

            <div className="space-y-3">
              <div className="flex gap-2">
                <Button type="button" variant="outline" fullWidth onClick={() => cameraInput.current?.click()}>{t('food.takePhoto')}</Button>
                <Button type="button" variant="outline" fullWidth onClick={() => galleryInput.current?.click()}>{t('food.choosePhoto')}</Button>
              </div>
              <input ref={cameraInput} data-testid="meal-camera-input" type="file" accept="image/jpeg,image/png,image/webp"
                capture="environment" className="hidden" aria-label={t('food.takePhoto')} onChange={choosePhoto} />
              <input ref={galleryInput} data-testid="meal-photo-input" type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" aria-label={t('food.choosePhoto')} onChange={choosePhoto} />
              {photo && <div className="space-y-2">
                <img src={photo.preview} alt={t('food.mealPhotoAlt')} className="w-full max-h-52 rounded-2xl object-contain bg-gray-50" />
                <button type="button" onClick={removePhoto} className="text-sm text-primary-600">{t('food.removePhoto')}</button>
              </div>}
              <p className="text-xs text-gray-500 leading-relaxed">{t('food.photoPrivacy')}</p>
            </div>

            {/* Optional notes help the model estimate the consumed portion. */}
            <div className="space-y-1.5">
              <label htmlFor="ai-meal-description" className="text-sm font-medium text-gray-700">{t(photo ? 'food.photoNotes' : 'food.describeMeal')}</label>
              <textarea
                id="ai-meal-description"
                value={description}
                onChange={(e) => { setDescription(e.target.value); clearResult() }}
                maxLength={500}
                placeholder={t('food.aiPlaceholder')}
                rows={3}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-primary-400 resize-none"
              />
            </div>
          </fieldset>

          {preparingPhoto && <p role="status" className="text-sm text-gray-500">{t('food.photoPreparing')}</p>}
          <p className="text-xs text-gray-500 leading-relaxed">{t('food.aiEstimateNote')}</p>

          {error && (
            <p role="alert" className="text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-2 text-center">
              {error}
            </p>
          )}

          {/* Analysis result */}
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
                      aria-label={t('food.deleteEntry', { name: f.food_name })}
                      disabled={saving}
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

          {/* Review and save actions */}
          {foods ? (
            <div className="flex gap-3">
              <Button variant="outline" disabled={saving} onClick={clearResult}>
                {t('food.reanalyze')}
              </Button>
              <Button fullWidth loading={saving} onClick={handleSave} disabled={foods.length === 0}>
                {t('food.saveAll')}
              </Button>
            </div>
          ) : (
            <Button fullWidth loading={analyzing} disabled={preparingPhoto} onClick={handleAnalyze}>
              {analyzing ? t('food.aiAnalyzing') : t('food.aiRecognize')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
