# Installed production dependency review — 2026-10-09

Scope: the 23 non-development packages actually installed on this Windows PC and present in the current lockfile. Codex read the full licence text for each of the 21 packages that include one. Two packages omit a licence file; their evidence is resolved separately below. Versions and licence bytes/hashes are recorded in `installed-production.json`. This is a component review, not complete project legal clearance or proof of which modules survive bundling.

## Missing-file follow-up

- `@pixi/colord@2.9.6`: installed and npm metadata say MIT, with Vlad Shilov as author. The [Pixi fork](https://github.com/pixijs/colord) and its [v2.9.6 package](https://github.com/pixijs/colord/blob/v2.9.6/package.json) identify the scoped package. Read its [tagged licence](https://github.com/pixijs/colord/blob/v2.9.6/LICENSE.md) completely: MIT, copyright 2020 Vlad Shilov. Retained that 1,083-byte text locally under the owner's standing download permission, for attribution. The tagged manifest was also read directly when web extraction failed. This resolves the missing text; no code dependency was added.
- `@msgpackr-extract/msgpackr-extract-win32-x64@3.0.4`: installed metadata declares MIT and the same author/repository as `msgpackr-extract@3.0.4`. Read that release's [licence](https://github.com/kriszyp/msgpackr-extract/blob/v3.0.4/LICENSE) and [manifest/build commands](https://github.com/kriszyp/msgpackr-extract/blob/v3.0.4/package.json); the manifest explicitly publishes the Windows x64 platform package from the same project. Use its installed parent licence, copyright 2020 Kris Zyp. This establishes published licence provenance, not a reproducible-build or binary-security audit.

## Obligations recorded from the texts

MIT and ISC packages require preserving their copyright/permission notices. BSD-3-Clause adds the non-endorsement condition and requires notices/disclaimer with binary distributions. Apache-2.0 requires its licence, applicable notices and modification notices if modified; no root NOTICE file was found in installed detect-libc. Its source header credits 2017 Lovell Fuller and others. The three existing fonts use SIL OFL 1.1: preserve their notices/licence, observe any reserved font names and do not sell fonts by themselves. Lilita One expressly reserves its font name. Fonts are not being modified or renamed here.

These are operational summaries of the individual texts, not a substitute for them. Existing utility dependencies and fonts retain their own licences; original game content remains a separate requirement.

## Remaining work

Produce reproducible distribution notices and verify the actual client/server deliverables. Audit development/build tools if distributed, other-platform binaries, embedded third-party snippets and all game names/art/audio individually. Re-review changed dependency versions; a package's licence metadata alone is insufficient. No claim about trademarks, copied expression, age/ratings, consumer law, privacy policy or release readiness follows from this inventory.
