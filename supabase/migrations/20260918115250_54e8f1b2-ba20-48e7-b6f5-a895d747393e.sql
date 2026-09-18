CREATE TABLE public.emg_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid(),
  measured_at timestamptz NOT NULL,
  side text NOT NULL DEFAULT 'both',
  rms_uv numeric(8,2) NOT NULL,
  peak_uv numeric(8,2) NOT NULL,
  episodes integer NOT NULL DEFAULT 0,
  clench_seconds integer NOT NULL DEFAULT 0,
  sleep_hours numeric(4,1),
  note text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emg_side_check CHECK (side IN ('left','right','both')),
  CONSTRAINT emg_rms_check CHECK (rms_uv >= 0 AND rms_uv <= 5000),
  CONSTRAINT emg_peak_check CHECK (peak_uv >= 0 AND peak_uv <= 10000)
);

CREATE INDEX emg_measurements_user_time_idx ON public.emg_measurements (user_id, measured_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emg_measurements TO authenticated;
GRANT ALL ON public.emg_measurements TO service_role;

ALTER TABLE public.emg_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own and demo measurements" ON public.emg_measurements
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Insert own measurements" ON public.emg_measurements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_demo = false);

CREATE POLICY "Update own measurements" ON public.emg_measurements
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own measurements" ON public.emg_measurements
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.emg_measurements (user_id, measured_at, side, rms_uv, peak_uv, episodes, clench_seconds, sleep_hours, note, is_demo)
SELECT
  NULL,
  (date_trunc('day', now()) - (g || ' days')::interval + interval '2 hours'),
  CASE WHEN g % 7 = 0 THEN 'left' WHEN g % 11 = 0 THEN 'right' ELSE 'both' END,
  ROUND((58 + 26 * sin(g / 5.0) + 14 * sin(g / 1.7) + CASE WHEN EXTRACT(dow FROM (now() - (g || ' days')::interval)) IN (1,4) THEN 18 ELSE 0 END)::numeric, 2),
  ROUND((150 + 70 * sin(g / 4.0) + 40 * sin(g / 2.3) + CASE WHEN EXTRACT(dow FROM (now() - (g || ' days')::interval)) IN (1,4) THEN 55 ELSE 0 END)::numeric, 2),
  GREATEST(0, ROUND(22 + 12 * sin(g / 3.5) + 6 * sin(g / 1.3))::int),
  GREATEST(0, ROUND(210 + 120 * sin(g / 4.5) + 55 * sin(g / 1.9))::int),
  ROUND((6.8 + 1.1 * sin(g / 6.0))::numeric, 1),
  CASE WHEN g % 13 = 0 THEN 'Высокая стрессовая нагрузка накануне' WHEN g % 17 = 0 THEN 'Приём кофеина вечером' ELSE NULL END,
  true
FROM generate_series(0, 89) AS g;