## A11yLens Extension — Workspace Rules

- **Modular architecture**: Each feature is a separate module in `popup/modules/` with a single `init*()` export
- **Constants/config** go to `popup/modules/constants.js`
- **Shared utilities** go to `popup/modules/utils.js`
- **No dead code, no duplicated logic** — extract shared patterns immediately
- **Injected page scripts** can't import modules — pass constants via `args` parameter
- **Injected page styles** use CSS classes from `content-inject.css`, loaded via `ensureContentCSS(tabId)` from `utils.js`
- **Panel registration**: HTML in `popup/panel.html`, init import + initializer map entry in `popup/panel.js`
- **Tests** live in `test/` — Playwright E2E with `launchPersistentContext`
