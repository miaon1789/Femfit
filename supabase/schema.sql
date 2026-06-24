-- ============================================================
-- FemFit Database Schema
-- 运行环境：Supabase (PostgreSQL)
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴运行
-- ============================================================

-- ── 扩展 ──────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── users ─────────────────────────────────────────────────────
-- 与 Supabase Auth 的 auth.users 表 1:1 关联
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  nickname            TEXT NOT NULL DEFAULT '',
  birth_year          SMALLINT,
  birth_month         SMALLINT CHECK (birth_month BETWEEN 1 AND 12),
  height_cm           NUMERIC(5,1) CHECK (height_cm > 0),
  weight_kg           NUMERIC(5,2) CHECK (weight_kg > 0),
  target_weight_kg    NUMERIC(5,2) CHECK (target_weight_kg > 0),
  activity_level      TEXT NOT NULL DEFAULT 'sedentary'
                        CHECK (activity_level IN ('sedentary','light','moderate','heavy')),
  weight_goal_pace    TEXT NOT NULL DEFAULT 'slow'
                        CHECK (weight_goal_pace IN ('slow','moderate','fast')),
  cycle_regular       BOOLEAN NOT NULL DEFAULT TRUE,
  last_period_date    DATE,
  avg_cycle_days      SMALLINT NOT NULL DEFAULT 28 CHECK (avg_cycle_days BETWEEN 20 AND 45),
  avg_period_days     SMALLINT NOT NULL DEFAULT 5  CHECK (avg_period_days BETWEEN 2 AND 10),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_tier   TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','premium')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── weight_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  weight_kg  NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)   -- 每天只保留最新一条（通过 upsert 实现）
);

-- ── measurement_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.measurement_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  chest_cm    NUMERIC(5,1),
  waist_cm    NUMERIC(5,1),
  navel_cm    NUMERIC(5,1),
  hip_cm      NUMERIC(5,1),
  thigh_l_cm  NUMERIC(5,1),
  thigh_r_cm  NUMERIC(5,1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ── period_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.period_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date   DATE,
  flow_level SMALLINT CHECK (flow_level BETWEEN 1 AND 3),  -- 1=轻 2=中 3=重
  pain_level SMALLINT CHECK (pain_level BETWEEN 1 AND 3),
  mood       TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT period_dates_valid CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ── meal_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meal_logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── food_entries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.food_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_log_id UUID NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
  food_name   TEXT NOT NULL,
  quantity    NUMERIC(8,2) NOT NULL DEFAULT 100,
  unit        TEXT NOT NULL DEFAULT 'g',
  calories    NUMERIC(8,1) NOT NULL DEFAULT 0,
  protein_g   NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_g     NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_g       NUMERIC(6,2) NOT NULL DEFAULT 0,
  fiber_g     NUMERIC(6,2) NOT NULL DEFAULT 0,
  iron_mg     NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── food_database ─────────────────────────────────────────────
-- 全局食物数据库（非用户维度）
CREATE TABLE IF NOT EXISTS public.food_database (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  alias        TEXT[],            -- 别名搜索
  category     TEXT NOT NULL,
  serving_size NUMERIC(8,2) NOT NULL DEFAULT 100,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  calories     NUMERIC(8,1) NOT NULL,
  protein_g    NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_g        NUMERIC(6,2) NOT NULL DEFAULT 0,
  fiber_g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  iron_mg      NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 全文搜索索引（中文食物名）
CREATE INDEX IF NOT EXISTS food_db_name_idx ON public.food_database USING GIN (to_tsvector('simple', name));

-- ── user_foods ────────────────────────────────────────────────
-- 用户自定义食物
CREATE TABLE IF NOT EXISTS public.user_foods (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '自定义',
  serving_size NUMERIC(8,2) NOT NULL DEFAULT 100,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  calories     NUMERIC(8,1) NOT NULL,
  protein_g    NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_g        NUMERIC(6,2) NOT NULL DEFAULT 0,
  fiber_g      NUMERIC(6,2) NOT NULL DEFAULT 0,
  iron_mg      NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ai_reports ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('daily_analysis','weekly_report','meal_analysis')),
  content      TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB
);

-- ── subscriptions ─────────────────────────────────────────────
-- 预留会员订阅表
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL DEFAULT 'premium',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  payment_method  TEXT,
  external_sub_id TEXT,  -- Stripe/微信支付的订阅 ID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_foods        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     ENABLE ROW LEVEL SECURITY;

-- users: 只能访问自己的记录
CREATE POLICY "users: self access" ON public.users
  FOR ALL USING (auth.uid() = id);

-- weight_logs
CREATE POLICY "weight_logs: self access" ON public.weight_logs
  FOR ALL USING (auth.uid() = user_id);

-- measurement_logs
CREATE POLICY "measurement_logs: self access" ON public.measurement_logs
  FOR ALL USING (auth.uid() = user_id);

-- period_logs
CREATE POLICY "period_logs: self access" ON public.period_logs
  FOR ALL USING (auth.uid() = user_id);

-- meal_logs
CREATE POLICY "meal_logs: self access" ON public.meal_logs
  FOR ALL USING (auth.uid() = user_id);

-- food_entries: 通过 meal_logs 关联鉴权
CREATE POLICY "food_entries: self access" ON public.food_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.meal_logs ml
      WHERE ml.id = meal_log_id AND ml.user_id = auth.uid()
    )
  );

-- food_database: 所有登录用户可读
CREATE POLICY "food_database: authenticated read" ON public.food_database
  FOR SELECT USING (auth.role() = 'authenticated');

-- user_foods
CREATE POLICY "user_foods: self access" ON public.user_foods
  FOR ALL USING (auth.uid() = user_id);

-- ai_reports
CREATE POLICY "ai_reports: self access" ON public.ai_reports
  FOR ALL USING (auth.uid() = user_id);

-- subscriptions
CREATE POLICY "subscriptions: self read" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- Triggers
-- ============================================================

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 新用户注册时自动创建 users 记录（只保留 email）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Indexes（性能优化）
-- ============================================================

CREATE INDEX IF NOT EXISTS weight_logs_user_date_idx      ON public.weight_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS measurement_logs_user_date_idx ON public.measurement_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS period_logs_user_start_idx     ON public.period_logs(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS meal_logs_user_date_idx        ON public.meal_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS ai_reports_user_generated_idx  ON public.ai_reports(user_id, generated_at DESC);
