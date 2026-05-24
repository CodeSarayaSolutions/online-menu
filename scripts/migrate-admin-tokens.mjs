import fs from 'fs';
import path from 'path';

const roots = [
  'src/app/admin',
  'src/components/admin',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.tsx')) files.push(p);
  }
  return files;
}

function migrate(content) {
  let c = content;

  c = c.replace(/\bbg-white\/95\b/g, 'adm-header backdrop-blur-md');
  c = c.replace(/\bbg-gray-50\b/g, 'adm-surface-2');
  c = c.replace(/\bbg-gray-100\b/g, 'adm-surface-2');
  c = c.replace(/\bbg-gray-800\b/g, 'adm-surface');
  c = c.replace(/\bbg-gray-900\b/g, 'adm-surface');
  c = c.replace(/\bbg-gray-950\b/g, 'adm-surface');
  c = c.replace(/\bbg-white\b/g, 'adm-surface adm-border border');
  c = c.replace(/\bbg-bg\b/g, 'adm-bg');

  c = c.replace(/\bborder-gray-100\/80\b/g, 'border adm-border');
  c = c.replace(/\bborder-gray-100\b/g, 'border adm-border');
  c = c.replace(/\bborder-gray-200\b/g, 'border adm-border');
  c = c.replace(/\bborder-gray-700\b/g, 'border adm-border');
  c = c.replace(/\bborder-gray-800\b/g, 'border adm-border');

  c = c.replace(/\btext-gray-900\b/g, 'adm-text');
  c = c.replace(/\btext-gray-600\b/g, 'adm-text-muted');
  c = c.replace(/\btext-gray-500\b/g, 'adm-text-muted');
  c = c.replace(/\btext-gray-400\b/g, 'adm-text-muted');
  c = c.replace(/\btext-black\b/g, 'adm-text');

  c = c.replace(/\btext-muted\/50\b/g, 'adm-text-faint');
  c = c.replace(/\btext-muted\/40\b/g, 'adm-text-faint');
  c = c.replace(/\btext-muted\/60\b/g, 'adm-text-muted');
  c = c.replace(/\btext-muted\/30\b/g, 'adm-text-faint');
  c = c.replace(/\btext-muted\/20\b/g, 'adm-text-faint');
  c = c.replace(/\btext-muted\/15\b/g, 'adm-text-faint');

  c = c.replace(/\bhover:bg-bg\b/g, 'hover:bg-[var(--adm-surface-2)]');
  c = c.replace(/\bhover:bg-gray-100\b/g, 'hover:bg-[var(--adm-surface-2)]');
  c = c.replace(/\bhover:text-dark\b/g, 'hover:adm-text');
  c = c.replace(/\bgroup-hover:text-dark\b/g, 'group-hover:adm-text');

  c = c.replace(/\btext-dark\b/g, 'text-dark adm-text');
  c = c.replace(/\btext-muted\b/g, 'text-muted adm-text-muted');

  c = c.replace(/\bfocus:bg-white\b/g, 'focus:adm-surface');
  c = c.replace(/\bfocus:bg-bg\b/g, 'focus:adm-surface-2');

  // Inputs: common patterns
  c = c.replace(
    /className="([^"]*?)bg-bg([^"]*?)"/g,
    (m, a, b) => {
      if (m.includes('adm-input')) return m;
      return `className="${a}adm-input bg-bg${b}"`.replace('bg-bg', '');
    }
  );
  c = c.replace(
    /className='([^']*?)bg-bg([^']*?)'/g,
    (m, a, b) => {
      if (m.includes('adm-input')) return m;
      return `className='${a}adm-input${b}'`;
    }
  );

  // Deduplicate
  c = c.replace(/\badm-text adm-text\b/g, 'adm-text');
  c = c.replace(/\badm-text-muted adm-text-muted\b/g, 'adm-text-muted');
  c = c.replace(/\bborder adm-border border adm-border\b/g, 'border adm-border');
  c = c.replace(/\badm-surface adm-border border adm-surface adm-border border\b/g, 'adm-surface adm-border border');
  c = c.replace(/\badm-surface adm-border border adm-border border\b/g, 'adm-surface adm-border border');

  return c;
}

let count = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = migrate(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      count++;
      console.log('updated', file);
    }
  }
}
console.log('done', count, 'files');
