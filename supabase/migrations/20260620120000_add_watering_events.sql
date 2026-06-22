CREATE TABLE watering_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id   uuid REFERENCES fields(id) ON DELETE CASCADE,
  watered_at date NOT NULL DEFAULT CURRENT_DATE,
  amount_mm  numeric(5,2) NOT NULL DEFAULT 2.0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE watering_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watering_events_select_owner"
  ON watering_events FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "watering_events_insert_owner"
  ON watering_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "watering_events_delete_owner"
  ON watering_events FOR DELETE TO authenticated USING (user_id = auth.uid());
