# AGENTS.md — Hearthfall (read this, then `HANDOFF.md` completely)

**Mission:** build a full, authored, almost-1:1 *layout* of Diablo III's New Tristram hub (original art and names) as a real game world in the existing TypeScript game, with working collision and every D3 town service (Blacksmith, Jeweler, Mystic/enchanting, Stash, Cube, Waypoint, Rift Obelisk, …) as physical NPCs. Details, plan, milestones and gates: **`HANDOFF.md`**.

**Branch:** work ONLY on `codex/new-tristram-town`. Baseline = branch `claude/wizardly-feynman-9hd73d` = tag `baseline-original-ts-794f77e`. Run `git branch --show-current` before every push. No force-push, no rebase of pushed commits, no deleting branches/tags, no `git clean -fdx`, never touch the baseline branch.

**Stack:** TypeScript + PixiJS 8 + Preact client, TypeScript/Node authoritative 20 Hz server, shared rules in `shared/`. Windows 11 + PowerShell. `npm run dev` (client :5173, server :2567), `npm run typecheck`, `npm test`, `npm run test:server` (613 pass / 2 known Windows SIGTERM failures), `npx tsx server/test/sim.ts`, `npm run build`.

**Hard rules**
1. NO AI SLOP: never invent designs/numbers; ground every decision in real references or measurements, logged in `docs/town/REFERENCES.md` before designing; label placeholders; say measured vs inferred vs unverified; if evidence is thin, stop and ask the owner.
2. Everything that ships is original (art, names, text, audio). New Tristram is a layout/scale/mood **reference only**. Verify every third-party licence individually; EU owner.
3. No paid services or credit spend. **Every download needs the owner's explicit OK** (name, source, size).
4. Do not break the working game (combat, skills, loot, UI look, characters, multiplayer, saves). Never commit `server/data/`, `.local/`, `.env`. **Use an isolated `DATA_DIR` for every test.**
5. Collision must be real and identical on server and client; services must be verified server-side by NPC proximity.
6. Verify visually in a real browser at 1920×1080 and look at your screenshots; benchmark honestly (hidden tabs pause `requestAnimationFrame`).
7. Stop at the owner gates in `HANDOFF.md` §8. Use they/them for the owner. `git commit -F file` (no multi-line `-m` on PowerShell 5.1).

**Freedom:** the plan in `HANDOFF.md` §6–§7 is a recommendation. You may exceed or replace it if you can show a better result — record it in `docs/town/DECISIONS.md` (what/why/evidence/rollback) and mention it in your next report. The hard rules above never bend.
