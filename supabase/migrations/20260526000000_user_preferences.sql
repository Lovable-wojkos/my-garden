-- ─────────────────────────────────────────
-- user_preferences (one row per user)
-- ─────────────────────────────────────────
CREATE TABLE user_preferences (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  city_name  text NOT NULL,
  latitude   numeric(9,6) NOT NULL,
  longitude  numeric(9,6) NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_owner"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_preferences_insert_owner"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences_update_owner"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_preferences_delete_owner"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
