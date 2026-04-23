# A11yLens — Chrome Web Store Listing

## Extension Name
A11yLens — Accessibility Inspector

## Short Description (132 characters max)
Audit any web page for accessibility issues. Scorecard, ARIA tree, contrast, keyboard, mobile viewport, and screen reader simulation.

## Category
Developer Tools → Accessibility

## Detailed Description

A11yLens is a free, open-source accessibility inspector that helps developers and QA teams find and fix WCAG issues directly in the browser.

### What It Does

**Scorecard** — One-click audit that grades your page A–F across 5 weighted categories: Keyboard, ARIA, Visual Clarity, Structure, and Content. Tracks scores over time so you can measure improvement.

**Automated Scan** — Powered by axe-core, surfaces violations, passes, and incomplete checks with click-to-locate highlighting on the page.

**Structure Analysis**
• Heading outline with skip-level detection
• Landmark navigation with role mapping
• Full ARIA tree via Chrome Accessibility API

**Content Audit**
• Form label checker — finds unlabelled inputs, broken for/id links
• Image alt text review — missing, empty, or suspicious alt attributes

**Keyboard Testing**
• Tab stop visualization with order numbering
• Keyboard shortcut audit (accesskey conflicts, missing handlers)
• Manual keyboard test — record your own tab-through with a focus trail overlay
• Component-level flow analysis

**Visual Checks**
• Contrast ratio checker against WCAG AA/AAA
• Touch target size audit (WCAG 2.5.5 / 2.5.8)
• Text spacing override (WCAG 1.4.12)
• Color vision deficiency simulation — deuteranopia, protanopia, tritanopia, achromatopsia, blurred vision
• Motion & animation audit — CSS animations, autoplay media, GIF detection, prefers-reduced-motion check

**Screen Reader Simulation**
• Live reading order preview
• Focus trap detection
• Accessible name computation testing
• ARIA live region monitoring

**Mobile Viewport**
• Device emulation — iPhone SE, iPhone 14, Pixel 7, iPad, iPad Pro, or custom sizes
• Mobile-specific audit — touch target sizing and horizontal overflow at emulated viewport

**Scan History**
• Timeline of all scorecard runs across pages
• Per-URL comparison — score deltas and category-by-category changes

### How It Works
A11yLens runs entirely in your browser. No data is sent to any server. All audits execute locally using page injection (axe-core) and Chrome DevTools Protocol (for ARIA tree inspection and device emulation). Scan history is stored in local browser storage only.

### Permissions Explained
• **Active Tab + Scripting**: Injects audit scripts into the page you're inspecting
• **Debugger**: Required to access the Chrome Accessibility Tree API and device emulation — there is no alternative web API for reading the full ARIA tree
• **Windows**: Opens the A11yLens panel as a side-by-side window
• **Tabs**: Identifies which page to audit and captures screenshots for the text spacing tool
• **Storage**: Saves scan history and recording state locally in your browser
• **Host permissions (all URLs)**: Needed so the extension can audit any website you visit

### Privacy
A11yLens collects zero data. No analytics, no tracking, no network requests. Everything stays in your browser. See our privacy policy for details.

---

## Single Purpose Description
(Required by Chrome Web Store — explains the extension's single purpose)

A11yLens helps web developers identify and fix accessibility issues on any web page by running automated audits, visualizing keyboard navigation, inspecting the ARIA tree, and simulating assistive technology experiences.

---

## Permission Justifications
(You'll fill these into the Chrome Web Store developer dashboard)

### activeTab
Used to access the current page when the user clicks the extension. Required to inject accessibility audit scripts.

### scripting
Used to inject axe-core accessibility engine and custom audit scripts into the active tab for scanning violations, checking contrast, measuring touch targets, and other accessibility checks.

### debugger
Required to access Chrome's Accessibility Tree API (Accessibility.getFullAXTree, Accessibility.getPartialAXTree) for ARIA tree inspection and accessible name computation. Also used for device emulation (Emulation.setDeviceMetricsOverride) and color vision deficiency simulation (Emulation.setEmulatedVisionDeficiency). There is no alternative web platform API for reading the browser's accessibility tree.

### windows
Used to open the A11yLens inspector panel as a detached side-by-side window next to the page being audited, and to manage window focus during manual keyboard testing.

### tabs
Used to query the active tab to determine which page to audit, to focus the target tab during manual keyboard recording, and to capture visible tab screenshots for the text spacing comparison tool.

### storage
Used to persist scan history (chrome.storage.local) so users can track accessibility score trends over time, and to save manual keyboard test recording state (chrome.storage.session) across popup reopens.

### host_permissions: <all_urls>
Required because the extension needs to inject accessibility audit scripts into any website the user wants to inspect. Without this, chrome.scripting.executeScript cannot run on arbitrary pages.

---

## Screenshots Needed
(Take these yourself — Chrome Web Store requires 1-5 screenshots at 1280×800 or 640×400)

1. **Scorecard** — Run scorecard on a real website showing the grade, ring chart, and category cards
2. **Scan Results** — Auto-check panel showing violations with click-to-locate
3. **ARIA Tree** — Structure panel showing the full accessibility tree
4. **Keyboard** — Tab stops visualization with numbered overlay on a page
5. **Mobile Viewport** — Device emulation with mobile audit results

---

## Icons Needed
(Create or generate these — required sizes)

- 16×16 px — toolbar icon
- 48×48 px — extension management page
- 128×128 px — Chrome Web Store listing

Suggested design: A lens/magnifying glass icon with "A11y" text or an eye symbol, using an accessible blue (#1565c0) on transparent background.
