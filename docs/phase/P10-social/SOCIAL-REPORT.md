# C103 — Friends, privacy and chat audiences

2026-10-10. F-SOC-02 implemented for current legacy character identity. F-SOC-03 selected10a channels implemented; guild channel remains10b. F-SOC-04 block/mute implemented, report queue awaits owner retention/staff-policy choice. This is not fullP10/G8 acceptance.

Saved per-character friend/block/mute lists (80each,8-row pages); mutual friends can see coarse presence unless hidden. No last-seen history. Whisper policy Everyone/Mutual friends & party/Nobody, default middle. Block prevents both-direction whispers/invitations and suppresses incoming public chat/presence. Mute hides incoming chat only. Existing party must be left explicitly. No account ownership claim: legacy names still identify saves.

Zone remains default; explicit world/party/trade/LFG/whisper audiences, sender/recipient labels, chat-name reply button, /w /p /world /trade /lfg commands. Trade chat is not trading. Existing5-message/1per-second chat budget covers all routes and slash commands. Text remains escaped Preact text; control/bidi-format characters normalized. Ordinary messages memory-only and client history cleared on disconnect/new character. Server validates audience and no availability details on whisper denial. SOCIAL_DISABLED_CHANNELS blocks new social actions and additional channels while preserving contact removal/privacy controls and filtered zone chat.

Save13/protocol17; optional social record absent in older characters has safe defaults. Unknown malformed social state is preserved and social actions fail closed. Durable commands use existing save-before-success path, no cross-character writes.

Evidence: L123/D061; ten focused social/affected-party cases pass, typecheck/build pass. Build main1292.05kB/gzip419.36kB (existing size warning). Real local Chrome two-client check: mutual presence,8-row first page/second page, addressed whisper with literal markup; SOCIAL-PREVIEW.jpg inspected1920x1080 with no scrolling. Saved-block reconnect check recorded below after completion. No performance/full-human claim.

No gameplay content removed. Future: reports/moderation/guilds/inspect/group finder, authenticated account identity, party combat review and remaining10a acceptance. Rollback: per-channel flag, preserve saved optional state; older servers must not read version13.

Real-client follow-through: SocialB103 blocked SocialA103 through the UI, reloaded, rejoined and still showed Blocked1 with the correct name. BLOCK-RECONNECT.jpg inspected at that tab's native viewport. Both temporary tabs closed; viewport reset. This confirms the actual command/save/reconnect path for the selected action.
