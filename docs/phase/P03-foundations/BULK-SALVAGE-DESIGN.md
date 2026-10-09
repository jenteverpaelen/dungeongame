# Bulk salvage follows its existing menu

Recorded2026-10-09 before code; evidence L64 at30556e8. Roadmap F-ITM-07/U-50 scope only; no automatic-salvage feature is introduced.

The server will accept only Normal, Magic and Rare for `salvageAll`, from the same readonly shared list used by the menu. Legendary and Set remain individually salvageable. Any invalid entry rejects the entire command before mutation. Empty/oversized arrays still reject; repeated allowed entries remain harmless through set deduplication. Equipment and stash never enter the inventory loop.

Test generated Warrior/Mage/Ranger saves at the actual Blacksmith, covering all five rarities and socket returns. First demonstrate rejection failures on the old implementation. Then check mixed allowed/forbidden/unknown inputs preserve the complete save, valid bulk consumes exactly the selected inventory items and yields their exact materials/XP/gems, retries cannot pay twice, other locations reject, and individual Legendary/Set salvage still succeeds. Update the existing bot's debug-level setup to target those individual IDs. Use fresh DATA_DIR for every execution, never actual saves.

Verify the full strict suite after changing server behavior. Inspect the existing menu and actual successful/failed requests in local installed Chrome at1920x1080. No layout/style/camera/town changes are planned. This removes only a direct-command path contradicted by the visible contract; it removes no item or reward content. No saved data is migrated. Reverting shared list/callers/guards and regressions restores the old mismatch; prefer a corrective follow-up instead.
