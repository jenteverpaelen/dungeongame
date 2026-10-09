# Audio context lifetime — C042

2026-10-09, owner PC, Node24.19.0 and installed Chrome154.0.8037.99. Evidence before code: L53, AUDIO-01, AUDIO-LIFETIME-DESIGN.md and actual browser reproduction at af43c60.

## Change and measured result

Disconnect and committed zone entry now cancel channel-loop requests and reset the remembered channel flag. The engine uses its existing250ms fade/300ms stop path, including clearing requests queued before browser unlock. Sound bank, gains, category settings, town emitters/mix, priority/rate policy, one-shot tails and background-tab behavior are unchanged. No content was removed. Read-only inspection now distinguishes requested and registered channel loops.

Before: a real local socket close leaves the actual channel source, pending intent and channel flag active on the selection screen. Its ended event does not fire during the observation. After: both collections are empty, flag false and ended observed. The fixture pauses the game ticker across the close to prove cleanup does not depend on another game frame; rendering then resumes before the selection screenshot.

Zone-entry cleanup is also verified before the next frame. This is a direct committed-zone-handler fixture, not an actual travel command. Real reconnect restores the full client world; a new channel starts and its ordinary stop still ends playback. The synthetic browser setting remains muted with master gain0 throughout; no subjective audibility/listening claim. A separate unit test covers pre-unlock request cancellation, repeated cleanup and a subsequent request.

## Evidence / limits

- Pilot `hf-audio-lifetime-NoozEH`: current entity flag was overwritten by applyLatest(), so no channel started. Corrected only the fixture to set the newest presentation sample; `checks/audio-lifetime/pilot-fixture.json` retains this failure.
- Reproduced before `hf-audio-lifetime-o6rl4H`: `checks/audio-lifetime/before/trace.json` and two1080p captures. An earlier successful before run `hf-audio-lifetime-ZC2CRj` paused selection rendering too; the retained final capture resumes rendering.
- After `hf-audio-lifetime-CnQCDb`: `checks/audio-lifetime/after/trace.json` and three1080p captures. Source ended, reconnect/channel restart, zone boundary and mute checks pass; default620-world-height camera and visible document confirmed.
- Fresh temporary DATA_DIR/profile for every browser run; owned processes closed. No real saves/profile, external download, autoplay-policy override or dependency installation.

All five retained before/after frames were opened and inspected. Town, minimap, HUD, interaction prompt and original layout remain present. Selection portraits are blank in both versions: main.ts stops their observer on game entry and never starts it on return. This is a separate existing defect found by visual inspection, not an audio-fix regression; tracked for the next change. Repeated town-entry notices in the last image come from the explicit handler/reconnect fixtures. Startup/paused FPS labels are not performance measurements.

Standalone typecheck and the queued-intent regression pass. All18 strict verification stages pass (746server/382simulation;5 client preference/audio tests), root `hearthfall-verify-PP4Y91`; exact stages are in `checks/audio-lifetime-verify.json`. The existing bundle-size advisory remains. This does not certify dense mixes, clipping, voice priority, device output, human accessibility or100-player performance. Rollback reverts lifecycle calls/helper together and restores the measured leak; no save migration.
