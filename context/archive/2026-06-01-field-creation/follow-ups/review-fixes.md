# Review Fixes — field-creation

## F1 — Region combobox trigger can submit the form accidentally

- **Decision**: FIXED
- **Action**: Added `type="button"` to the region combobox trigger in `src/components/fields/CreateFieldForm.tsx`.

## F2 — API exposes raw database errors to the browser

- **Decision**: FIXED
- **Action**: Mapped foreign-key insert failures to a `400` `region_id` validation error and replaced raw Supabase error responses with a generic `500` message plus server-side logging.
