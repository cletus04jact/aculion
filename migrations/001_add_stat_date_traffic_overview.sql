-- Migration: Add stat_date and composite unique constraint to traffic_overview
-- Timezone standard: Asia/Kolkata (IST, UTC+05:30)

-- 1. Add stat_date column with default date in Asia/Kolkata
ALTER TABLE public.traffic_overview 
ADD COLUMN IF NOT EXISTS stat_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;

-- 2. Add is_legacy column to flag multi-day cumulative rows created before date partitioning
ALTER TABLE public.traffic_overview 
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT false;

-- 3. Update existing historical/cumulative rows
UPDATE public.traffic_overview
SET 
    stat_date = (created_at AT TIME ZONE 'Asia/Kolkata')::date,
    is_legacy = true
WHERE created_at < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;

-- 4. Drop the old single-column unique constraint on billboard_code
ALTER TABLE public.traffic_overview 
DROP CONSTRAINT IF EXISTS traffic_overview_billboard_code_key;

-- 5. Drop any existing duplicate composite constraint if re-running
ALTER TABLE public.traffic_overview 
DROP CONSTRAINT IF EXISTS traffic_overview_billboard_stat_date_key;

-- 6. Add composite unique constraint on (billboard_code, stat_date)
ALTER TABLE public.traffic_overview 
ADD CONSTRAINT traffic_overview_billboard_stat_date_key UNIQUE (billboard_code, stat_date);

-- 7. Add index for fast date and billboard lookups
CREATE INDEX IF NOT EXISTS idx_traffic_overview_bb_date 
ON public.traffic_overview (billboard_code, stat_date);

-- 8. Also add stat_date to traffic_overview_history if not present for clean history tracking
ALTER TABLE public.traffic_overview_history
ADD COLUMN IF NOT EXISTS stat_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
