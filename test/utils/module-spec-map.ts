/**
 * Maps extension source files to their corresponding test spec(s).
 * Key: relative path from the extension root.
 * Value: array of spec file names (without path).
 */
export const MODULE_SPEC_MAP: Record<string, string[]> = {
  'popup/modules/auto-check.js':       ['auto-check.spec.ts'],
  'popup/modules/heading-outline.js':  ['headings.spec.ts'],
  'popup/modules/landmark-nav.js':     ['landmarks.spec.ts'],
  'popup/modules/alt-review.js':       ['alt-review.spec.ts'],
  'popup/modules/contrast.js':         ['contrast.spec.ts'],
  'popup/modules/form-labeller.js':    ['form-labels.spec.ts'],
  'popup/modules/tab-stops.js':        ['tab-stops.spec.ts'],
  'popup/modules/text-spacing.js':     ['text-spacing.spec.ts'],
  'popup/modules/aria-tree.js':        ['aria-tree.spec.ts'],
  'popup/modules/aria-tree-render.js': ['aria-tree.spec.ts'],
  'popup/modules/name-calc.js':        ['name-calc.spec.ts'],
};

/** Files whose change triggers ALL specs. */
export const SHARED_FILES = [
  'popup/modules/utils.js',
  'popup/modules/constants.js',
  'popup/panel.html',
  'popup/panel.js',
  'popup/popup.css',
  'background.js',
];

/** Directories to watch for changes. */
export const WATCH_DIRS = [
  'popup/modules',
  'popup',
  '.',  // for background.js
];
