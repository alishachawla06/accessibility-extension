import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { MODULE_SPEC_MAP, SHARED_FILES } from './utils/module-spec-map';

const EXT_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = __dirname;
const SPECS_DIR = path.join(TEST_DIR, 'specs');

// Debounce: ignore events within 2s of the last run
let lastRun = 0;
const DEBOUNCE_MS = 2000;

function getSpecsForFile(relPath: string): string[] {
  // Normalize to forward slashes
  const normalized = relPath.replace(/\\/g, '/');

  // Check if it's a shared file → run all specs
  if (SHARED_FILES.some(f => normalized.endsWith(f))) {
    return fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.spec.ts'));
  }

  // Check direct mapping
  for (const [moduleFile, specs] of Object.entries(MODULE_SPEC_MAP)) {
    if (normalized.endsWith(moduleFile)) return specs;
  }

  return [];
}

function runSpecs(specs: string[], changedFile: string) {
  const now = Date.now();
  if (now - lastRun < DEBOUNCE_MS) return;
  lastRun = now;

  const unique = [...new Set(specs)];
  const specPaths = unique.map(s => `specs/${s}`).join(' ');

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📁 Changed: ${changedFile}`);
  console.log(`🧪 Running: ${unique.join(', ')}`);
  console.log(`${'─'.repeat(60)}\n`);

  try {
    execSync(`npx playwright test ${specPaths} --headed --timeout 30000`, {
      cwd: TEST_DIR,
      stdio: 'inherit',
    });
    console.log(`\n✅ All tests passed for: ${changedFile}\n`);
  } catch {
    console.log(`\n❌ Tests failed for: ${changedFile}\n`);
  }
}

// ── Watch extension files ──
const watchPaths = [
  path.join(EXT_ROOT, 'popup', 'modules'),
  path.join(EXT_ROOT, 'popup'),
  EXT_ROOT,
];

console.log('👀 Watching extension files for changes...\n');
console.log('Mapped modules:');
for (const [file, specs] of Object.entries(MODULE_SPEC_MAP)) {
  console.log(`  ${file} → ${specs.join(', ')}`);
}
console.log(`\nShared files (trigger all specs): ${SHARED_FILES.join(', ')}`);
console.log(`${'─'.repeat(60)}\n`);

for (const dir of watchPaths) {
  if (!fs.existsSync(dir)) continue;

  fs.watch(dir, { recursive: false }, (_event, filename) => {
    if (!filename) return;
    // Skip non-relevant files
    if (!filename.endsWith('.js') && !filename.endsWith('.css') && !filename.endsWith('.html')) return;
    // Skip test files
    if (filename.endsWith('.spec.ts')) return;

    const relPath = path.relative(EXT_ROOT, path.join(dir, filename)).replace(/\\/g, '/');
    const specs = getSpecsForFile(relPath);

    if (specs.length > 0) {
      runSpecs(specs, relPath);
    }
  });
}

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n👋 Watcher stopped.');
  process.exit(0);
});
