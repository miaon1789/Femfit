import dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import type { ActivityLevel, WeightGoalPace } from '@/types'

// ── Step 组件 ─────────────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current ? 'bg-primary-500 w-6' : i === current ? 'bg-primary-300 w-6' : 'bg-gray-200 w-3'
          }`}
        />
      ))}
    </div>
  )
}

// ── Step 1: 欢迎页 ────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  const features = [
    { icon: '📅', title: t('onboarding.feature1Title'), desc: t('onboarding.feature1Desc') },
    { icon: '🥗', title: t('onboarding.feature2Title'), desc: t('onboarding.feature2Desc') },
    { icon: '📊', title: t('onboarding.feature3Title'), desc: t('onboarding.feature3Desc') },
  ]
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="text-7xl mt-4">🌸</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('onboarding.welcomeTitle')}</h1>
        <p className="text-gray-500 leading-relaxed text-sm">
          {t('onboarding.welcomeLead1')}<br />
          <span className="text-primary-600 font-medium">{t('onboarding.welcomeLead2')}</span>
        </p>
      </div>
      <div className="w-full bg-primary-50 rounded-3xl p-5 text-left space-y-3">
        {features.map(({ icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{title}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Button fullWidth size="lg" onClick={onNext}>
        {t('onboarding.startSetup')}
      </Button>
      <p className="text-xs text-gray-400">{t('onboarding.takesTwoMin')}</p>
    </div>
  )
}

// ── Step 2: 基本信息 ──────────────────────────────────────────────────────────

interface BasicInfo {
  nickname: string
  birthYear: string
  birthMonth: string
  heightCm: string
  weightKg: string
}

function BasicInfoStep({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: BasicInfo
  onChange: (d: BasicInfo) => void
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const errors: Partial<BasicInfo> = {}
  const validate = () => {
    let ok = true
    if (!data.nickname.trim()) { errors.nickname = t('onboarding.errNickname'); ok = false }
    const y = parseInt(data.birthYear)
    if (!y || y < 1950 || y > 2010) { errors.birthYear = t('onboarding.errBirthYear'); ok = false }
    const m = parseInt(data.birthMonth)
    if (!m || m < 1 || m > 12) { errors.birthMonth = t('onboarding.errBirthMonth'); ok = false }
    const h = parseFloat(data.heightCm)
    if (!h || h < 140 || h > 220) { errors.heightCm = t('onboarding.errHeight'); ok = false }
    const w = parseFloat(data.weightKg)
    if (!w || w < 30 || w > 200) { errors.weightKg = t('onboarding.errWeight'); ok = false }
    return ok
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('onboarding.basicTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('onboarding.basicSubtitle')}</p>
      </div>
      <Input
        label={t('onboarding.nickname')}
        placeholder={t('onboarding.nicknamePlaceholder')}
        value={data.nickname}
        onChange={(e) => onChange({ ...data, nickname: e.target.value })}
        error={errors.nickname}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('onboarding.birthYear')}
          type="number"
          placeholder={t('onboarding.birthYearPlaceholder')}
          value={data.birthYear}
          onChange={(e) => onChange({ ...data, birthYear: e.target.value })}
          error={errors.birthYear}
        />
        <Input
          label={t('onboarding.birthMonth')}
          type="number"
          placeholder="1-12"
          value={data.birthMonth}
          onChange={(e) => onChange({ ...data, birthMonth: e.target.value })}
          error={errors.birthMonth}
        />
      </div>
      <Input
        label={t('onboarding.height')}
        type="number"
        placeholder="160"
        suffix="cm"
        value={data.heightCm}
        onChange={(e) => onChange({ ...data, heightCm: e.target.value })}
        error={errors.heightCm}
      />
      <Input
        label={t('onboarding.currentWeight')}
        type="number"
        placeholder="55.0"
        suffix="kg"
        value={data.weightKg}
        onChange={(e) => onChange({ ...data, weightKg: e.target.value })}
        error={errors.weightKg}
      />
      <div className="flex gap-3 mt-2">
        <Button variant="secondary" fullWidth onClick={onBack}>{t('onboarding.back')}</Button>
        <Button fullWidth onClick={() => { if (validate()) onNext() }}>{t('onboarding.next')}</Button>
      </div>
    </div>
  )
}

// ── Step 3: 目标设定 ──────────────────────────────────────────────────────────

interface GoalInfo {
  targetWeightKg: string
  activityLevel: ActivityLevel
  weightGoalPace: WeightGoalPace
}

const activityOptions: { value: ActivityLevel; descKey: string }[] = [
  { value: 'sedentary', descKey: 'onboarding.activitySedentaryDesc' },
  { value: 'light', descKey: 'onboarding.activityLightDesc' },
  { value: 'moderate', descKey: 'onboarding.activityModerateDesc' },
  { value: 'heavy', descKey: 'onboarding.activityHeavyDesc' },
]

const paceOptions: { value: WeightGoalPace; labelKey: string; descKey: string; recommended?: boolean }[] = [
  { value: 'slow', labelKey: 'onboarding.paceSlowLabel', descKey: 'onboarding.paceSlowDesc', recommended: true },
  { value: 'moderate', labelKey: 'onboarding.paceModerateLabel', descKey: 'onboarding.paceModerateDesc' },
  { value: 'fast', labelKey: 'onboarding.paceFastLabel', descKey: 'onboarding.paceFastDesc' },
]

function GoalStep({
  data,
  currentWeight,
  onChange,
  onNext,
  onBack,
}: {
  data: GoalInfo
  currentWeight: number
  onChange: (d: GoalInfo) => void
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState('')

  const validate = () => {
    const target = parseFloat(data.targetWeightKg)
    if (!target || target < 30 || target > 200) { setError(t('onboarding.errTargetWeight')); return false }
    if (target >= currentWeight) { setError(t('onboarding.errTargetBelowCurrent')); return false }
    return true
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('onboarding.goalTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('onboarding.goalSubtitle')}</p>
      </div>
      <Input
        label={t('onboarding.targetWeight')}
        type="number"
        placeholder="50.0"
        suffix="kg"
        value={data.targetWeightKg}
        onChange={(e) => { setError(''); onChange({ ...data, targetWeightKg: e.target.value }) }}
        error={error}
      />
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.activityLevelLabel')}</p>
        <div className="grid grid-cols-1 gap-2">
          {activityOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...data, activityLevel: opt.value })}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                data.activityLevel === opt.value
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{t(`activity.${opt.value}`)}</p>
                <p className="text-xs text-gray-400">{t(opt.descKey)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.paceLabel')}</p>
        <div className="grid grid-cols-1 gap-2">
          {paceOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...data, weightGoalPace: opt.value })}
              className={`flex items-center justify-between p-3 rounded-2xl border-2 text-left transition-all ${
                data.weightGoalPace === opt.value
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{t(opt.labelKey)}</p>
                <p className="text-xs text-gray-400">{t(opt.descKey)}</p>
              </div>
              {opt.recommended && (
                <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">
                  {t('onboarding.recommended')}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 mt-2">
        <Button variant="secondary" fullWidth onClick={onBack}>{t('onboarding.back')}</Button>
        <Button fullWidth onClick={() => { if (validate()) onNext() }}>{t('onboarding.next')}</Button>
      </div>
    </div>
  )
}

// ── Step 4: 月经信息 ──────────────────────────────────────────────────────────

interface CycleFormInfo {
  cycleRegular: boolean
  lastPeriodDate: string
  avgCycleDays: string
  avgPeriodDays: string
}

function CycleStep({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: CycleFormInfo
  onChange: (d: CycleFormInfo) => void
  onNext: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<Partial<Record<keyof CycleFormInfo, string>>>({})

  const validate = () => {
    const errs: typeof errors = {}
    if (!data.lastPeriodDate) { errs.lastPeriodDate = t('onboarding.errSelectDate') }
    const c = parseInt(data.avgCycleDays)
    if (!c || c < 20 || c > 45) { errs.avgCycleDays = t('onboarding.errCycleDays') }
    const p = parseInt(data.avgPeriodDays)
    if (!p || p < 2 || p > 10) { errs.avgPeriodDays = t('onboarding.errPeriodDays') }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Limit date picker to past 60 days
  const today = dayjs().format('YYYY-MM-DD')
  const minDate = dayjs().subtract(60, 'day').format('YYYY-MM-DD')

  const regularOptions = [
    { value: true, label: t('onboarding.regular'), desc: t('onboarding.regularDesc') },
    { value: false, label: t('onboarding.irregular'), desc: t('onboarding.irregularDesc') },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('onboarding.cycleTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('onboarding.cycleSubtitle')}</p>
      </div>
      <div className="bg-primary-50 rounded-2xl p-4">
        <p className="text-xs text-primary-700">{t('onboarding.privacyNote')}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.cycleRegularQ')}</p>
        <div className="grid grid-cols-2 gap-3">
          {regularOptions.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange({ ...data, cycleRegular: opt.value })}
              className={`p-3 rounded-2xl border-2 text-center transition-all ${
                data.cycleRegular === opt.value
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-100 bg-white'
              }`}
            >
              <p className="text-sm font-medium text-gray-800">{opt.label}</p>
              <p className="text-xs text-gray-400">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <Input
        label={t('onboarding.lastPeriodDate')}
        type="date"
        value={data.lastPeriodDate}
        min={minDate}
        max={today}
        onChange={(e) => { setErrors({}); onChange({ ...data, lastPeriodDate: e.target.value }) }}
        error={errors.lastPeriodDate}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('onboarding.avgCycleDays')}
          type="number"
          placeholder="28"
          suffix={t('onboarding.daysUnit')}
          value={data.avgCycleDays}
          onChange={(e) => { setErrors({}); onChange({ ...data, avgCycleDays: e.target.value }) }}
          error={errors.avgCycleDays}
          hint={t('onboarding.avgCycleHint')}
        />
        <Input
          label={t('onboarding.avgPeriodDays')}
          type="number"
          placeholder="5"
          suffix={t('onboarding.daysUnit')}
          value={data.avgPeriodDays}
          onChange={(e) => { setErrors({}); onChange({ ...data, avgPeriodDays: e.target.value }) }}
          error={errors.avgPeriodDays}
          hint={t('onboarding.avgPeriodHint')}
        />
      </div>
      <div className="flex gap-3 mt-2">
        <Button variant="secondary" fullWidth onClick={onBack}>{t('onboarding.back')}</Button>
        <Button fullWidth onClick={() => { if (validate()) onNext() }}>{t('onboarding.finish')}</Button>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const { setProfile } = useUserStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [basic, setBasic] = useState<BasicInfo>({
    nickname: '', birthYear: '', birthMonth: '', heightCm: '', weightKg: '',
  })
  const [goal, setGoal] = useState<GoalInfo>({
    targetWeightKg: '', activityLevel: 'sedentary', weightGoalPace: 'slow',
  })
  const [cycle, setCycle] = useState<CycleFormInfo>({
    cycleRegular: true, lastPeriodDate: '', avgCycleDays: '28', avgPeriodDays: '5',
  })

  const handleFinish = async () => {
    if (!user) return
    setSaving(true)
    try {
      const profileData = {
        id: user.id,
        email: user.email ?? '',
        nickname: basic.nickname.trim(),
        birth_year: parseInt(basic.birthYear),
        birth_month: parseInt(basic.birthMonth),
        height_cm: parseFloat(basic.heightCm),
        weight_kg: parseFloat(basic.weightKg),
        target_weight_kg: parseFloat(goal.targetWeightKg),
        activity_level: goal.activityLevel,
        weight_goal_pace: goal.weightGoalPace,
        cycle_regular: cycle.cycleRegular,
        last_period_date: cycle.lastPeriodDate,
        avg_cycle_days: parseInt(cycle.avgCycleDays),
        avg_period_days: parseInt(cycle.avgPeriodDays),
        onboarding_completed: true,
        subscription_tier: 'free' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('users')
        .upsert(profileData)
        .select()
        .single()
      if (error) throw error
      setProfile(data)
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Failed to save profile:', err)
      alert(t('onboarding.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const TOTAL_STEPS = 4

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-start justify-center">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-md mx-auto px-5 pt-10 pb-8">
        {step > 0 && <StepProgress current={step} total={TOTAL_STEPS} />}
        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
        {step === 1 && (
          <BasicInfoStep
            data={basic}
            onChange={setBasic}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <GoalStep
            data={goal}
            currentWeight={parseFloat(basic.weightKg) || 60}
            onChange={setGoal}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <CycleStep
            data={cycle}
            onChange={setCycle}
            onNext={handleFinish}
            onBack={() => setStep(2)}
          />
        )}
        {saving && (
          <div className="fixed inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl animate-bounce mb-2">🌸</div>
              <p className="text-gray-600">{t('onboarding.saving')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
