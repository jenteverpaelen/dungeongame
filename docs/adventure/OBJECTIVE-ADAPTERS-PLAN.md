# Counted objective adapters — C074

Evidence before implementation: L88, Claude P5, C041 live-event measurements and C065 acquisition-versus-possession experiments. Preserve current quest data/revisions/rewards. Add counters, monster-type filters, successful ground-item acquisition and successful artisan-operation events for future definitions.

Counts are persisted with the current step, bounded by its authored requirement and reset on advance. Existing one-kill objectives remain one kill. Only real successful server paths can emit credit; no client completion endpoint. Dead/remote/noReward kills, full-bag retries and unsuccessful service commands do not count. A collect objective is acquisition history, not item possession or delivery. No new economy amounts, content removals, map or camera changes.

Validate new definition fields and references; use focused tests for partial-save continuation, one action per event, failed/full-bag behavior and legacy compatibility. No repeated full-game walkthrough; the owner will playtest later. Remaining rift, delivery, wave, party/repeat and durable restore policy stay open.
