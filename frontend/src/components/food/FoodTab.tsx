import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFoodLogs } from '@/hooks/useFoodLogs'
import { useCalorieTarget } from '@/hooks/useCalorieTarget'
import { AddFoodSheet } from './AddFoodSheet'
import { AIMealSheet } from './AIMealSheet'
import { formatDateShort } from '@/lib/formatDate'
import type { MealType, FoodEntry } from '@/types'
import dayjs from 'dayjs'

const MEAL_ICON: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎',
}
const MEAL_KEY: Record<MealType, string> = {
  breakfast: 'food.mealBreakfast', lunch: 'food.mealLunch',
  dinner: 'food.mealDinner', snack: 'food.mealSnack',
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** 按当前时间猜测餐次，作为 AI 识别的默认值 */
function guessMeal(): MealType {
  const h = dayjs().hour()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 20) return 'dinner'
  return 'snack'
}

export function FoodTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const today = dayjs().format('YYYY-MM-DD')
  const [selectedDate, setSelectedDate] = useState(today)
  const [addingTo, setAddingTo] = useState<MealType | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMeal, setAiMeal] = useState<MealType>(guessMeal())
  const [copying, setCopying] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  const { loading, addFoodEntry, addFoodEntries, copyPreviousMeal, deleteFoodEntry, totalCalories, mealCalories, entriesFor } =
    useFoodLogs(selectedDate)

  const calorieTarget = useCalorieTarget()
  const target = calorieTarget?.finalTarget ?? null
  const isToday = selectedDate === today

  const progress = target && totalCalories > 0
    ? Math.min(100, Math.round((totalCalories / target) * 100))
    : 0

  return (
    <div className="space-y-4">
      {/* 日期选择 */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            {isToday ? t('food.today') : formatDateShort(selectedDate, lang)}
          </p>
          <p data-testid="daily-calories" className="text-xl font-bold text-gray-900">
            {totalCalories.toLocaleString()}
            <span className="text-sm text-gray-400 font-normal ml-1">{t('food.kcalEaten')}</span>
          </p>
          {isToday && target && (
            <p className="text-xs text-gray-400 mt-0.5">
              {t('food.targetRemaining', {
                target: target.toLocaleString(),
                remaining: Math.max(0, target - totalCalories).toLocaleString(),
              })}
            </p>
          )}
        </div>
        <input
          disabled={copying}
          type="date"
          max={today}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm text-gray-600 border border-gray-200 rounded-xl px-2 py-1 focus:outline-none focus:border-primary-400"
        />
      </div>

      {/* 摄入进度条（仅今天） */}
      {isToday && target && (
        <div className="px-1">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                progress >= 100 ? 'bg-amber-400' : 'bg-primary-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{progress}%</span>
            {progress >= 100 && (
              <span className="text-amber-500">{t('food.goalReachedNote')}</span>
            )}
          </div>
        </div>
      )}

      {/* AI 识别入口 */}
      <button
        onClick={() => { setAiMeal(guessMeal()); setAiOpen(true) }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-primary-200 bg-primary-50 text-primary-600 text-sm font-medium hover:bg-primary-100 transition-colors"
      >
        {t('food.aiRecognizeMeal')}
      </button>

      {copyMessage && <p role="status" className="text-sm text-primary-600">{copyMessage}</p>}
      {/* 四餐卡片 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">
          <div className="text-3xl animate-pulse mb-2">🥗</div>
          <p className="text-sm">{t('common.loading')}</p>
        </div>
      ) : (
        MEAL_ORDER.map((mealType) => {
          const entries = entriesFor(mealType)
          const kcal = mealCalories(mealType)

          return (
            <div key={mealType} data-testid={`meal-${mealType}`} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {/* 餐次标题行 */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{MEAL_ICON[mealType]}</span>
                  <span className="text-sm font-semibold text-gray-700">{t(MEAL_KEY[mealType])}</span>
                  {kcal > 0 && (
                    <span data-testid="meal-calories" className="text-xs text-gray-400">{kcal} kcal</span>
                  )}
                </div>
                <button
                  aria-label={t('food.addTo', { meal: t(MEAL_KEY[mealType]) })}
                  onClick={() => setAddingTo(mealType)}
                  className="w-7 h-7 rounded-full bg-primary-50 text-primary-500 flex items-center justify-center text-lg leading-none hover:bg-primary-100 transition-colors"
                >
                  +
                </button>
              </div>

              <button disabled={copying} className="px-5 py-2 text-xs text-primary-600 disabled:opacity-50" onClick={async () => {
                setCopying(true); setCopyMessage('')
                try { setCopyMessage(t(await copyPreviousMeal(mealType) ? 'food.copyDone' : 'food.copyEmpty')) }
                catch { setCopyMessage(t('food.saveFailed')) }
                finally { setCopying(false) }
              }}>{t('food.copyPrevious')}</button>
              {/* 食物条目 */}
              {entries.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {entries.map((entry) => (
                    <FoodEntryRow
                      key={entry.id}
                      entry={entry}
                      onDelete={() => deleteFoodEntry(entry.id, mealType)}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-gray-300 text-center">{t('food.addFoodHint')}</p>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* 宏量营养汇总（有记录时显示） */}
      {totalCalories > 0 && <MacroSummary entries={MEAL_ORDER.flatMap((tab) => entriesFor(tab))} />}

      {/* AddFoodSheet */}
      {addingTo && (
        <AddFoodSheet
          mealType={addingTo}
          onClose={() => setAddingTo(null)}
          onAI={() => { setAiMeal(addingTo); setAddingTo(null); setAiOpen(true) }}
          onSave={(payload) => addFoodEntry(addingTo, payload)}
        />
      )}

      {/* AI 识别面板 */}
      {aiOpen && (
        <AIMealSheet
          date={selectedDate}
          defaultMeal={aiMeal}
          onClose={() => setAiOpen(false)}
          onSave={async (mealType, foods) => {
            await addFoodEntries(mealType, foods)
          }}
        />
      )}
    </div>
  )
}

function FoodEntryRow({ entry, onDelete }: { entry: FoodEntry; onDelete: () => void }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  const hasMacros = Number(entry.protein_g) > 0 || Number(entry.carbs_g) > 0 || Number(entry.fat_g) > 0

  return (
    <div className="flex items-center justify-between px-5 py-3 gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-700 truncate">{entry.food_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">
            {entry.quantity}{entry.unit} · {Math.round(Number(entry.calories))} kcal
          </span>
          {hasMacros && (
            <span className="text-xs text-gray-300">
              {t('food.protein')} {Math.round(Number(entry.protein_g))}g · {t('food.carbs')} {Math.round(Number(entry.carbs_g))}g · {t('food.fat')} {Math.round(Number(entry.fat_g))}g
            </span>
          )}
        </div>
      </div>
      {confirming ? (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { onDelete(); setConfirming(false) }}
            className="text-xs text-red-500 font-medium"
          >
            {t('food.confirmDelete')}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-gray-400"
          >
            {t('food.cancel')}
          </button>
        </div>
      ) : (
        <button
          aria-label={t('food.deleteEntry', { name: entry.food_name })}
          onClick={() => setConfirming(true)}
          className="text-gray-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}

function MacroSummary({ entries }: { entries: FoodEntry[] }) {
  const { t } = useTranslation()
  const protein = Math.round(entries.reduce((s, e) => s + Number(e.protein_g), 0))
  const carbs   = Math.round(entries.reduce((s, e) => s + Number(e.carbs_g), 0))
  const fat     = Math.round(entries.reduce((s, e) => s + Number(e.fat_g), 0))

  if (protein === 0 && carbs === 0 && fat === 0) return null

  const total = protein * 4 + carbs * 4 + fat * 9
  const pPct  = total > 0 ? Math.round((protein * 4 / total) * 100) : 0
  const cPct  = total > 0 ? Math.round((carbs * 4 / total) * 100) : 0
  const fPct  = total > 0 ? 100 - pPct - cPct : 0

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm font-semibold text-gray-700 mb-3">{t('food.nutrients')}</p>
      {/* 色条 */}
      <div className="flex h-2 rounded-full overflow-hidden mb-3">
        <div className="bg-blue-400" style={{ width: `${pPct}%` }} />
        <div className="bg-amber-400" style={{ width: `${cPct}%` }} />
        <div className="bg-rose-400" style={{ width: `${fPct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-base font-bold text-blue-500">{protein}g</p>
          <p className="text-xs text-gray-400">{t('food.protein')}</p>
        </div>
        <div>
          <p className="text-base font-bold text-amber-500">{carbs}g</p>
          <p className="text-xs text-gray-400">{t('food.carbs')}</p>
        </div>
        <div>
          <p className="text-base font-bold text-rose-500">{fat}g</p>
          <p className="text-xs text-gray-400">{t('food.fat')}</p>
        </div>
      </div>
    </div>
  )
}
