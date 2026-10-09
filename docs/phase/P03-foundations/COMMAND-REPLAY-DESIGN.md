# Command replay audit and bounded protection

2026-10-09, evidence before code. Roadmap F-SAV-05; this is connection-local protection, not a durable transaction ledger.

## Evidence

- Local inspection: `Connection.cmd` starts at ID 1, increments for each invocation, and waits eight seconds for a reply. It does not automatically retry. `Session.onCmd` accepts any finite number and executes the handler every time; IDs only correlate replies. Commands run synchronously. Message admission is capped at 60/s, payloads at 64 KiB. Existing item-ID checks protect some operations, but do not make repeatable costs/actions idempotent. Reproduce a repeated gem-fusion request before changing this path.
- [AWS Builders' Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): read the request-identifier, atomicity, equivalent-response, late-request and changed-parameters sections. Caller-provided identifiers distinguish a retry from two intentional identical actions. Remembering a result and detecting changed parameters avoid ambiguous repeat execution. Durable guarantees require atomic recording with the mutation. No AWS service/dependency is adopted.
- [RFC6455 §5.4](https://www.rfc-editor.org/rfc/rfc6455#section-5.4): read fragmentation/order/interleaving rules. This is transport framing, not application command deduplication or recovery after reconnect. Hearthfall's monotonically increasing IDs are an application contract supported by its actual sender.

## Proposed slice and rationale

**Measured before fix:** synthetic Session/MessagePack dispatch at the physical jeweler: first ID=1 fusion gives one rank-2 ruby, gold 999,998,500 and Cube XP 8. Repeating exactly ID=1 gives two rubies, gold 999,997,000 and XP 16. The new regression test fails on those repeat effects, as intended before the fix. Evidence: `hf-replay-before-a56a49d1a53f484bb1c563bf8bfcccf9/before.log`, this PC. This is an unwanted repeated paid action, not evidence of free item duplication or a network transport spontaneously duplicating packets.

Keep current command handlers, NPC checks, costs and UI unchanged. At the Session command entry, require positive safe integer IDs and accept new IDs only above this connection's high-water mark. Gaps are allowed. Return cached results for matching recent requests; reject ID reuse with changed operation/arguments. Old IDs whose results were evicted are refused, never executed again. New connections get independent histories; no automatic retry or cross-connection promise is added.

Fingerprint a deterministic, key-sorted representation of JSON-like operation/arguments. Reject unsupported/non-finite input instead of conflating it with null or string values. Clone cached results so later item/enchant mutations cannot rewrite the first answer. Store successful and failed handler results; invalid envelopes and admission/rate-limit denials happen before execution and are not completed-command receipts. A new attempt after a handler validation failure uses a new ID.

Bound history to the existing eight-second client wait multiplied by the existing 60-message/s cap (480 results), and cap retained serialized request fingerprints/results to the existing 64-KiB payload budget per connection. These are engineering bounds derived from current protocol constants, not game balance numbers or a guaranteed retry duration. Keep only a numeric high-water mark after eviction. Measure/record behavior at both limits; actual JS heap overhead is additional and must not be described as exactly 64 KiB.

Run mutation and receipt recording synchronously, before sending the reply. A caught handler failure is retained so it cannot rerun potentially partial effects. This does not roll those effects back. Future async handlers, multi-entity trade, reconnect retries and crash durability require a transactional ledger tied to stable account/character ownership; F-SAV-05 remains partial until that design exists.

## Acceptance and rollback

Isolated fixtures: duplicate fusion charges/produces once; a new ID intentionally repeats; changed payload is refused; same parameters with different key order match; cached item/enchant results remain stable; failed request does not become executable merely because player state changes; old/invalid IDs cannot mutate; eviction cannot reopen an ID; histories are per connection; existing default-debug and service proximity validation still run on new commands. Exercise the actual Session codec/dispatch and real WebSocket suite. No browser visual change is intended.

Removal: executing a reused command ID again is removed because it can repeat costs/actions. No content/system is removed. Rollback the integrated Session guard/protocol constants/tests; current save schema is unchanged. Keep evidence of the failure and explain the risk if reverting.
