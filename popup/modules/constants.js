// ─── Shared Constants ───────────────────────────────────────────────────────

// CSS selectors for landmark elements (used in injected page scripts via args)
export const LANDMARK_SELECTORS = [
  'header', 'nav', 'main', 'footer', 'aside', 'section[aria-label]', 'section[aria-labelledby]',
  'form[aria-label]', 'form[aria-labelledby]', 'search',
  '[role="banner"]', '[role="navigation"]', '[role="main"]', '[role="contentinfo"]',
  '[role="complementary"]', '[role="region"]', '[role="form"]', '[role="search"]'
];

// Semantic ARIA roles for element picker walk-up logic (passed via args to injected scripts)
export const SEMANTIC_ROLES = [
  'button', 'link', 'navigation', 'banner', 'main',
  'contentinfo', 'complementary', 'region', 'form', 'search', 'dialog',
  'alertdialog', 'heading', 'img', 'tab', 'tabpanel', 'menuitem',
  'checkbox', 'radio', 'textbox', 'combobox', 'listbox', 'slider',
  'menu', 'menubar', 'toolbar', 'tablist', 'tree', 'grid', 'row',
  'alert', 'status', 'log', 'marquee', 'timer', 'progressbar'
];

// Semantic HTML tags for element picker walk-up logic (passed via args to injected scripts)
export const SEMANTIC_TAGS = [
  'a', 'button', 'input', 'select', 'textarea', 'nav',
  'header', 'footer', 'main', 'aside', 'form', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'img', 'table', 'ul', 'ol', 'dialog', 'details', 'summary'
];

// Section/component tags used in getComponent for grouping elements
export const SECTION_TAGS = ['header', 'nav', 'main', 'footer', 'aside', 'section', 'form'];
export const SECTION_ROLES = ['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'region', 'form'];

// Tag-to-implicit-role mapping for HUD display
export const TAG_ROLE_MAP = {
  a: 'link', button: 'button', input: 'textbox', select: 'combobox',
  textarea: 'textbox', nav: 'navigation', header: 'banner', footer: 'contentinfo',
  main: 'main', aside: 'complementary', h1: 'heading', h2: 'heading', h3: 'heading',
  h4: 'heading', h5: 'heading', h6: 'heading', img: 'img', table: 'table',
  ul: 'list', ol: 'list', dialog: 'dialog', form: 'form'
};

// Tag-to-implicit-role mapping for landmarks
export const TAG_LANDMARK_MAP = {
  header: 'banner', nav: 'navigation', main: 'main', footer: 'contentinfo',
  aside: 'complementary', section: 'region', form: 'form', search: 'search'
};

export const WCAG_TAGS = {
  AA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  AAA: ['wcag2aaa', 'wcag21aaa', 'wcag22aaa'],
  BP: ['best-practice']
};

// Roles that MUST have an accessible name per ARIA spec
export const NAMED_ROLES = [
  'button', 'link', 'navigation', 'banner', 'main', 'contentinfo',
  'complementary', 'region', 'form', 'search', 'dialog', 'alertdialog',
  'heading', 'img', 'tab', 'tabpanel', 'menuitem', 'checkbox', 'radio',
  'textbox', 'combobox', 'listbox', 'slider', 'spinbutton', 'switch',
  'treeitem', 'option', 'progressbar', 'meter', 'alert'
];

// Landmark roles (ARIA landmarks + implicit HTML5 landmarks)
export const LANDMARK_ROLES = [
  'banner', 'navigation', 'main', 'contentinfo', 'complementary',
  'region', 'form', 'search'
];

// Interactive roles that require keyboard access
export const INTERACTIVE_ROLES = [
  'button', 'link', 'textbox', 'combobox', 'listbox', 'slider',
  'spinbutton', 'switch', 'checkbox', 'radio', 'menuitem',
  'tab', 'treeitem', 'option', 'searchbox', 'menuitemcheckbox',
  'menuitemradio', 'scrollbar'
];

// Name sources for display
export const NAME_SOURCE_LABELS = {
  'attribute': 'aria-label',
  'relatedElement': 'aria-labelledby',
  'contents': 'text content',
  'title': 'title attr',
  'placeholder': 'placeholder',
  'value': 'value',
};

// Fix suggestions for common axe-core rule violations
export const FIX_SUGGESTIONS = {
  'button-name': {
    fix: 'Add accessible text to the button',
    snippet: '<!-- Option 1: Add text content -->\n<button>Click me</button>\n\n<!-- Option 2: Add aria-label -->\n<button aria-label="Close dialog">×</button>\n\n<!-- Option 3: For icon buttons -->\n<button><svg ...><title>Search</title></svg></button>'
  },
  'image-alt': {
    fix: 'Add alt text to the image',
    snippet: '<!-- Informative image -->\n<img src="photo.jpg" alt="Description of the image">\n\n<!-- Decorative image -->\n<img src="border.png" alt="" role="presentation">'
  },
  'link-name': {
    fix: 'Add accessible text to the link',
    snippet: '<!-- Option 1: Text content -->\n<a href="/page">Read more about topic</a>\n\n<!-- Option 2: aria-label -->\n<a href="/page" aria-label="Read more about accessibility">\n  <img src="icon.svg" alt="">\n</a>'
  },
  'color-contrast': {
    fix: 'Ensure text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)',
    snippet: '/* Increase contrast by darkening text or lightening background */\n.low-contrast {\n  color: #1a1a1a;        /* darker text */\n  background: #ffffff;   /* lighter background */\n}'
  },
  'label': {
    fix: 'Add a label to the form field',
    snippet: '<!-- Option 1: Explicit label -->\n<label for="email">Email</label>\n<input type="email" id="email">\n\n<!-- Option 2: aria-label -->\n<input type="search" aria-label="Search site">\n\n<!-- Option 3: aria-labelledby -->\n<span id="qty-label">Quantity</span>\n<input type="number" aria-labelledby="qty-label">'
  },
  'input-image-alt': {
    fix: 'Add alt text to the input image',
    snippet: '<input type="image" src="submit.png" alt="Submit form">'
  },
  'select-name': {
    fix: 'Add a label to the select element',
    snippet: '<label for="country">Country</label>\n<select id="country">\n  <option>United States</option>\n</select>'
  },
  'aria-allowed-attr': {
    fix: 'Remove ARIA attributes that are not allowed for the element\'s role',
    snippet: '<!-- Remove disallowed ARIA attributes -->\n<!-- Before: -->\n<div role="heading" aria-checked="true">Title</div>\n<!-- After: -->\n<div role="heading" aria-level="2">Title</div>'
  },
  'aria-valid-attr-value': {
    fix: 'Fix the ARIA attribute value to a valid option',
    snippet: '<!-- aria-live must be: off, polite, or assertive -->\n<div aria-live="polite">Status updates here</div>\n\n<!-- aria-expanded must be: true or false -->\n<button aria-expanded="false">Toggle menu</button>'
  },
  'aria-roles': {
    fix: 'Use a valid ARIA role value',
    snippet: '<!-- Use valid WAI-ARIA roles -->\n<div role="navigation">...</div>\n<div role="button" tabindex="0">Click me</div>'
  },
  'duplicate-id': {
    fix: 'Ensure every id attribute value is unique',
    snippet: '<!-- Before: duplicate IDs -->\n<div id="header">...</div>\n<div id="header">...</div>\n\n<!-- After: unique IDs -->\n<div id="site-header">...</div>\n<div id="page-header">...</div>'
  },
  'html-has-lang': {
    fix: 'Add a lang attribute to the <html> element',
    snippet: '<html lang="en">\n  ...\n</html>'
  },
  'document-title': {
    fix: 'Add a <title> element inside <head>',
    snippet: '<head>\n  <title>Page Title - Site Name</title>\n</head>'
  },
  'heading-order': {
    fix: 'Ensure heading levels increase by one and don\'t skip levels',
    snippet: '<!-- Correct order -->\n<h1>Main Title</h1>\n  <h2>Section</h2>\n    <h3>Subsection</h3>\n\n<!-- Incorrect: skips h2 -->\n<h1>Title</h1>\n  <h3>Subsection</h3> <!-- ✗ Should be h2 -->'
  },
  'landmark-one-main': {
    fix: 'Add exactly one <main> landmark to the page',
    snippet: '<body>\n  <header>...</header>\n  <nav>...</nav>\n  <main>  <!-- One main landmark -->\n    ...\n  </main>\n  <footer>...</footer>\n</body>'
  },
  'region': {
    fix: 'Wrap all page content inside landmark regions',
    snippet: '<body>\n  <header>...</header>\n  <nav>...</nav>\n  <main>...</main>\n  <aside>...</aside>\n  <footer>...</footer>\n</body>'
  },
  'aria-hidden-focus': {
    fix: 'Remove focusable elements from aria-hidden containers',
    snippet: '<!-- Before: focusable inside aria-hidden -->\n<div aria-hidden="true">\n  <button>Click</button> <!-- ✗ trap -->\n</div>\n\n<!-- Fix: add tabindex="-1" -->\n<div aria-hidden="true">\n  <button tabindex="-1">Click</button>\n</div>'
  },
  'tabindex': {
    fix: 'Avoid tabindex values greater than 0',
    snippet: '<!-- Before -->\n<button tabindex="5">Click</button>\n\n<!-- After: use tabindex="0" for natural flow -->\n<button tabindex="0">Click</button>'
  },
  'list': {
    fix: 'Ensure lists only contain <li>, <script>, or <template> children',
    snippet: '<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>'
  },
  'listitem': {
    fix: 'Ensure <li> elements are inside <ul> or <ol>',
    snippet: '<ul>\n  <li>Item</li>\n</ul>'
  },
  'frame-title': {
    fix: 'Add a title attribute to iframe elements',
    snippet: '<iframe src="content.html" title="Embedded content description"></iframe>'
  },
  'meta-viewport': {
    fix: 'Don\'t disable user scaling in viewport meta tag',
    snippet: '<!-- Allow zoom -->\n<meta name="viewport" content="width=device-width, initial-scale=1">\n\n<!-- ✗ Avoid -->\n<meta name="viewport" content="maximum-scale=1, user-scalable=no">'
  },
  'bypass': {
    fix: 'Add a skip navigation link at the top of the page',
    snippet: '<body>\n  <a href="#main-content" class="skip-link">Skip to main content</a>\n  <nav>...</nav>\n  <main id="main-content">...</main>\n</body>'
  },
  'svg-img-alt': {
    fix: 'Add accessible name to SVG images',
    snippet: '<svg role="img" aria-label="Chart showing sales data">\n  <title>Sales Data Chart</title>\n  ...\n</svg>'
  },
  'form-field-multiple-labels': {
    fix: 'Ensure a form field has only one label',
    snippet: '<!-- Use one label per field -->\n<label for="name">Full name</label>\n<input id="name" type="text">'
  },
  'autocomplete-valid': {
    fix: 'Use valid autocomplete values',
    snippet: '<input type="email" autocomplete="email">\n<input type="text" autocomplete="given-name">\n<input type="tel" autocomplete="tel">'
  }
};
