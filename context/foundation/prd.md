---
project: Garden Management App
version: 1
status: draft
created: 2026-05-18
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

A garden management app for home gardeners and small-scale farmers that replaces error-prone paper notebooks with digital tracking, prevents data loss, and correlates weather data with planting outcomes to improve future decisions.

The pain emerged when observing a friend who tracks planting in a paper notebook every year. Notes get lost, making it impossible to recall what was planted, how much was used, and how much grew. There's no way to determine if previous years were dry or wet, which prevents learning from past seasons.

Pain category: workflow friction, data trapped somewhere, missing capability
Insight: Weather data correlation could improve planting decisions; digital tracking prevents loss and enables analysis

## User & Persona

Primary persona: Home gardeners and small-scale farmers who manage their own plots, track planting history manually, and want to correlate weather conditions with growing outcomes. This includes the user themselves and friends/family with similar needs.

## Success Criteria

### Primary

End-to-end flow works:
1. User opens app
2. User creates their field (draws columns and rows for MVP)
3. User selects plants from a list
4. User selects species, how much seeds used, weight or boxes
5. User sets seeding date (final date should be calculated)
6. User chooses a region (weather check based on this)
7. System pulls weather information at night (temp, rain)
8. User sees current weather in garden location
9. User sees rain level in mm for last 7 days
10. User sees when last rain took place

### Secondary

- Harvest tracking (record what was harvested)
- Reminder notifications for watering

### Guardrails

- Data backup — won't lose planting records
- Performance — loads in under 3 seconds on mobile
- Cross-browser support — works on Chrome, Safari, Firefox

## User Stories

### US-01: User creates a field and plants crops

**Given**: I am logged in as a user and have no fields in my garden

**When**: I add a new field, draw columns and rows to define the layout, select plants from the predefined list, record species, seed quantity and weight/boxes, set the seeding date (with automatic final date calculation), and choose a region for weather data

**Then**: I can see my field with the planting details displayed, view the current weather at my garden location, see rainfall in mm for the last 7 days, and see when the last rain took place

## Functional Requirements

### Field Management

- FR-001: User can add multiple fields to their garden. Priority: must-have
  > Socrates: Counter-argument considered: "Single field is sufficient for MVP — multiple fields adds complexity without clear value." Resolution: kept; real gardens have multiple fields, and the primary user has multiple fields. Single field is acceptable but multiple is needed for realism.
- FR-002: User can draw columns and rows for each field. Priority: must-have
  > Socrates: Counter-argument considered: "Simple list-based field entry is sufficient; drawing adds UI complexity." Resolution: kept; fields have multiple species in different rows, so visual layout is needed. Templates/creator for size/shape with species configuration is the approach.

### Planting

- FR-003: User can select plants from a predefined list. Priority: must-have
  > Socrates: Counter-argument considered: "Free-text plant entry is more flexible than a predefined list." Resolution: modified to hybrid approach; users can add text-based entries initially, with recommendations to accept from database later. Watering needs and growth time are calculated based on plant entry.
- FR-004: User can record species, seed quantity, weight or boxes for each planting. Priority: must-have
  > Socrates: Counter-argument considered: "This data isn't used for any calculation in MVP, so it's unnecessary." Resolution: removed from MVP; quantity/weight data entry adds burden without being used for calculations in the core flow.
- FR-005: User can set seeding date with automatic final date calculation. Priority: must-have
  > Socrates: Counter-argument considered: "Growth time varies too much by conditions to calculate accurately." Resolution: kept; plant database will be part of MVP with category-based mapping (e.g., tomatoes 6 weeks, potatoes 8 weeks). Exact species not needed, category-level precision is sufficient.
- FR-006: User can choose a region for weather data. Priority: must-have
  > Socrates: Counter-argument considered: "GPS-based automatic location is better than manual region selection." Resolution: kept; MVP will use IMGW API (Polish meteorological service) which is region-based. Region selection maps to what's accessible from the API structure.

### Weather

- FR-007: System automatically pulls weather data (temperature, rainfall) at night. Priority: must-have
  > Socrates: Counter-argument considered: "Pull on-demand is sufficient; automatic nightly pull adds server complexity." Resolution: kept; historical data is needed to create watering history. With low user volume expected, nightly pull is manageable and provides the historical rainfall data users need.
- FR-008: User can view current weather in garden location. Priority: must-have
  > Socrates: Counter-argument considered: "Historical rainfall is the key value; current weather is a distraction." Resolution: kept; users need both current weather and historical rainfall data to make watering decisions. Current weather provides immediate context, historical data shows patterns.
- FR-009: User can view rainfall in mm for last 7 days. Priority: must-have
  > Socrates: Counter-argument considered: "7 days is arbitrary; users might want different time windows." Resolution: acknowledged that 7 days is arbitrary; consider making time window configurable in future. FR does not duplicate "when last rain took place" - this shows cumulative rainfall, the other shows timing.
- FR-010: User can view when last rain took place. Priority: must-have
  > Socrates: Counter-argument considered: "This is implied by the 7-day rainfall view; explicit display is redundant." Resolution: kept; explicit display of when last rain took place provides immediate clarity that users need for quick decision-making, separate from cumulative rainfall data.

### Harvest

- FR-011: User can view planned harvest date. Priority: must-have
  > Socrates: Counter-argument considered: "Planned date is only an estimate; users can calculate themselves." Resolution: kept; this is an estimate automatically calculated from seeding date and plant category. User should not manually enter harvest date - the system provides the estimate.
- FR-012: User can record harvest data (what was harvested). Priority: nice-to-have
  > Socrates: Counter-argument considered: "Harvest data isn't used for calculations; it's just history." Resolution: kept as nice-to-have; defer to v2 if other MVP phases finish faster. Provides value for tracking yield over time but not critical for core watering decision flow.

### Notifications

- FR-013: User can receive watering notifications. Priority: nice-to-have
  > Socrates: Counter-argument considered: "Notifications require push infrastructure, complicating MVP." Resolution: modified to in-app notifications only for MVP; push notifications moved to v2. Reduces infrastructure complexity while still providing reminder capability within the web app.

### Administration

- FR-014: User can request new plant types. Priority: must-have
  > Socrates: Counter-argument considered: "Users can use text entries (FR-003), so formal requests are redundant." Resolution: kept; when users report a species, they clearly indicate what's needed. It's important that the plant catalog contains complete data, and user requests help identify gaps.
- FR-015: Admin can approve new plant type requests. Priority: must-have
  > Socrates: Counter-argument considered: "Admin can add plants directly; approval workflow is unnecessary." Resolution: kept; species and parameters are an important feature and value of the application. Some farmers must account/report what species they planted, so maintaining a complete and accurate plant catalog through admin approval is critical.

## Non-Functional Requirements

- Mobile-first design — users primarily access the application on mobile phones
- Performance — application loads and responds quickly even with slow internet connections (fields often have poor connectivity)
- Offline capability — core features should function with limited or intermittent internet access

## Business Logic

The application evaluates whether watering is needed based on plant needs and rainfall, and estimates harvest yields based on planting-to-harvest ratios.

The rule consumes user field layout and plant species data, along with rainfall data collected by region. For harvest estimation, the application uses ratios from the plant database (e.g., 2kg potatoes planted → 10kg harvest expected; 100g beet seeds → 20kg beets expected).

The output is watering suggestions via in-app notifications when rainfall sum is low, and harvest yield estimates displayed on the field screen. Users encounter this rule through notification prompts and yield estimates when viewing their planted fields.

## Access Control

Authentication: Email + magic link (passwordless). No password storage.

User roles:
- Regular users: Gardeners/farmers who manage their own gardens and planting data
- Administrators: Can add new plant species and manage system-wide data

Platform: Browser-based web application optimized for mobile devices (primary use case is farmers on phones).

## Non-Goals

- No community features or garden sharing between users
- No marketplace for seeds/plants — does not allow selling harvests or processed goods
- Does not support multiple fields in different locations for the same user (single location per user for MVP)
- Language support: Polish primary with English support (multi-language beyond Polish/English is out of scope)

## Open Questions
