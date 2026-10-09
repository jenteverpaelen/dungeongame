# Menu layout correction — C089

The owner rejected scrolling content menus after seeing First Steps. L103/D044 recorded their decision before implementation. Existing fonts/colors/frames remain; this is navigation and space use.

Help now uses a1040px-wide index/detail layout: ten lessons or fifteen hints remain directly selectable, FAQ search selects one readable answer, observations use pages, and controls use two columns. Skills separates Overview/Runes/Tiers/Casting/Rules and Skills/Targets/Guide. Journal uses quest index + detail with Story/Objectives/Reward/Rules; longer quest/lore/objective/delivery collections paginate. Character statistics use columns and separate power/set pages. Settings uses two columns and binding pages; gem fusion, learned Cube powers and rift difficulties use bounded pages. All options remain reachable; no content, saves or server operation was deleted.

Removed vertical auto-scroll rules from the inventoried menu containers. Future menu growth must use columns, sections or pages instead of extending a stack. Short native choice controls remain; the owner’s complaint was the content scrollbar, not a request to replace all native input widgets. Chat/log history is not a menu.

Typecheck passed. Actual local Chrome1920x1080 First Steps, Skills overview and journal columns were inspected and captured in images/. Final production build is recorded in the checkpoint. No extended playtest, new unit-test suite or balance claim for a presentation change. Other populated menu pages and smaller viewports remain for owner feedback; no universal screen-size claim.

Rollback is presentation only and must preserve access to every entry/action. The owner’s no-scroll preference remains the design constraint for future work.
