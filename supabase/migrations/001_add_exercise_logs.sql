-- ============================================================
-- Migration 001: Add exercise_logs table
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴运行
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercise_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  -- 步数
  steps              INTEGER CHECK (steps >= 0),
  step_tier          TEXT CHECK (step_tier IN ('low', 'normal', 'high', 'very_high')),
  -- 训练记录（可选）
  workout_type       TEXT CHECK (workout_type IN ('strength', 'cardio', 'hiit', 'yoga', 'other')),
  duration_minutes   INTEGER CHECK (duration_minutes > 0),
  heart_rate_avg     INTEGER CHECK (heart_rate_avg > 0),
  watch_calories     INTEGER CHECK (watch_calories >= 0),  -- 仅参考，不用于热量计算
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- RLS
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_logs: self access" ON public.exercise_logs
  FOR ALL USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER exercise_logs_updated_at
  BEFORE UPDATE ON public.exercise_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Index
CREATE INDEX IF NOT EXISTS exercise_logs_user_date_idx
  ON public.exercise_logs(user_id, date DESC);
