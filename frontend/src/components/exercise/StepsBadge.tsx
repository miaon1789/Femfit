import { useTranslation } from 'react-i18next'
import { STEP_TIER_META } from '@/hooks/useExerciseLogs'
import type { StepTier } from '@/types'

interface StepsBadgeProps {
  tier: StepTier
  steps?: number
  size?: 'sm' | 'md'
}

export function StepsBadge({ tier, steps, size = 'md' }: StepsBadgeProps) {
  const { t } = useTranslation()
  const meta = STEP_TIER_META[tier]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${meta.bg} ${meta.color} ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    }`}>
      {t(`exercise.stepTier.${tier}`)}
      {steps !== undefined && (
        <span className="opacity-70">· {steps.toLocaleString()} {t('common.stepsUnit')}</span>
      )}
    </span>
  )
}
