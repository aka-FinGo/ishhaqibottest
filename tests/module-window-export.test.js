// ============================================================
// tests/module-window-export.test.js — Verify HTML inline handlers
// ============================================================

import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve(process.cwd(), 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract inline handlers: onclick="foo()", onchange="bar()", oninput="baz()", onkeydown="qux()"
const handlerRegex = /on(?:click|change|input|keydown)\s*=\s*"([^"]+)"/g;
const functionsCalled = new Set();

let match;
while ((match = handlerRegex.exec(htmlContent)) !== null) {
  const code = match[1];
  // extract function names (e.g. switchTab, addHodim, etc.)
  const fnMatches = code.match(/([a-zA-Z0-9_$]+)\s*\(/g);
  if (fnMatches) {
    fnMatches.forEach(fn => {
      const cleanFn = fn.replace('(', '').trim();
      if (!['if', 'event', 'alert', 'confirm'].includes(cleanFn)) {
        functionsCalled.add(cleanFn);
      }
    });
  }
}

console.log(`🔍 Discovered ${functionsCalled.size} inline function calls in index.html:`);
console.log(Array.from(functionsCalled).sort().join(', '));

// Scan src/ files for window.<fn> assignments
const srcDir = path.resolve(process.cwd(), 'src');
function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const jsFiles = getAllJsFiles(srcDir);
let allSrcContent = '';
jsFiles.forEach(f => {
  allSrcContent += fs.readFileSync(f, 'utf8') + '\n';
});

const missingExports = [];
functionsCalled.forEach(fn => {
  const pattern1 = `window.${fn}`;
  const pattern2 = `export function ${fn}`;
  if (!allSrcContent.includes(pattern1) && !allSrcContent.includes(pattern2)) {
    missingExports.push(fn);
  }
});

if (missingExports.length > 0) {
  console.error('❌ Missing window exports for inline HTML handlers:', missingExports);
  process.exit(1);
} else {
  console.log('✅ ALL inline HTML function handlers are exported to window scope!');
  process.exit(0);
}
