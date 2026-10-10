# C102 — Explicit parties

2026-10-10. F-SOC-01 selected character/session scope implemented; P10 and G8 remain open.

Four members maximum, explicit invites/accept/decline/cancel, leave/kick/leader transfer,60s expiry and reconnect reservation, online successor on disconnect, coarse location/health frames. Server rechecks sender, recipient, capacity and leadership. Party IDs/member handles are opaque; legacy character identities still derive from public names, not authenticated accounts. No automatic travel, quest unlock, inventory access or reward change. PARTY_DISABLED_CHANNELS lists zone#channel pairs; leaving/declining/cancelling remain possible. Protocol16; save12 unchanged.

Research and rationale: REFERENCES L122 / DECISIONS D060. All UI uses existing panel materials. No content removed; no downloads.

Measured: five focused cases pass, including four simulated members, stale/foreign actions, bounded invitations, disconnect/reconnect expiry, per-channel admission and actual World command/channel integration. Typecheck/build pass. Two real Chrome clients on the owner's PC invited/accepted, transferred leadership and left; recipient state and HUD updated. PARTY-FINAL-1080.jpg inspected at1920x1080; initial white input corrected to existing dark/gold field styling. PARTY-PREVIEW.jpg records the two-member leader view at the second tab's native viewport. No scrollbar in inspected views. No frame-rate benchmark or maximum-crowd claim.

Remaining: real-client disconnect mid-action acceptance, friends/privacy/channels/reporting, party combat/scaling, authenticated account ownership, human and independent G8 review. Party health refreshes with existing1Hz world maintenance. Rollback: disable admission or restart for ephemeral groups; no saved rewards or progress need reversal.
