-- Harden plantings INSERT: caller must own the target field, not only the planting row.

DROP POLICY IF EXISTS "plantings_insert_owner" ON plantings;

CREATE POLICY "plantings_insert_owner"
  ON plantings FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM fields f
      WHERE f.id = field_id AND f.user_id = auth.uid()
    )
  );
