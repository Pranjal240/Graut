#!/usr/bin/env node
// Maintainer tool: re-copies every bundled skill from the commit pinned in sources.json.
// To update one: change its sha, run `node scripts/sync.js`, read the diff, then commit.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

process.env.GRAUT_HOME = path.join(os.tmpdir(), 'graut-sync');
const { fetchSource, stageSkill, loadManifest } = require('../skills/graut/scripts/graut.js');

const ROOT = path.join(__dirname, '..');
const SKILLS = path.join(ROOT, 'skills');
const LIBRARY = path.join(SKILLS, 'graut', 'library');
const NOTE =
  '> `<skill-dir>` below is the folder that contains this SKILL.md. Use its real path in commands. (Path edited by Graut.)';

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

function rewrite(dir, replacements) {
  for (const file of walk(dir).filter((f) => f.endsWith('.md'))) {
    const old = fs.readFileSync(file, 'utf8');
    let text = old;
    for (const [from, to] of Object.entries(replacements)) text = text.split(from).join(to);
    if (text === old) continue;
    if (path.basename(file) === 'SKILL.md') text = text.replace(/^(---\n[\s\S]*?\n---\n)/, `$1\n${NOTE}\n`);
    fs.writeFileSync(file, text);
  }
}

const executables = [];
fs.rmSync(LIBRARY, { recursive: true, force: true });

for (const source of loadManifest().sources) {
  console.log(source.repo);
  const skills = Object.entries(source.skills || {});
  const library = source.library || [];
  const repo = fetchSource(source, [...library, ...skills.flatMap(([, from]) => [].concat(from))]);
  const modes = execFileSync('git', ['-C', repo, 'ls-files', '-s'], { encoding: 'utf8', maxBuffer: 1 << 28 });

  for (const [name, from] of skills) {
    const stage = stageSkill(source, repo, name, from);
    const dest = path.join(SKILLS, name);
    fs.rmSync(dest, { recursive: true, force: true });
    // coverage data and caches are build leftovers, not part of a skill
    fs.cpSync(stage, dest, { recursive: true, filter: (f) => !/(^|[\\/])(\.coverage|__pycache__)$/.test(f) });
    if (source.replace) rewrite(dest, source.replace);
    for (const line of modes.split('\n').filter((l) => l.startsWith('100755'))) {
      const file = line.split('\t')[1];
      for (const item of [].concat(from)) {
        const inside = Array.isArray(from) ? path.basename(item) : '';
        if (file.startsWith(`${item}/`)) executables.push(path.join('skills', name, inside, file.slice(item.length + 1)));
      }
    }
  }

  // Search lists and reference docs: text only, so pictures do not bloat the repo.
  if (library.length) {
    const dest = path.join(LIBRARY, source.id);
    for (const item of library) {
      fs.cpSync(path.join(repo, item), path.join(dest, item), {
        recursive: true,
        filter: (f) => fs.statSync(f).isDirectory() || /\.(md|json)$/.test(f),
      });
    }
    for (const file of fs.readdirSync(repo).filter((f) => /^(LICENSE|NOTICE)/i.test(f))) {
      fs.cpSync(path.join(repo, file), path.join(dest, `UPSTREAM-${file}`));
    }
  }
}

// Windows does not record the executable bit, so it is set in the git index.
if (fs.existsSync(path.join(ROOT, '.git'))) {
  for (const file of executables) {
    execFileSync('git', ['-C', ROOT, 'update-index', '--add', '--chmod=+x', file.replace(/\\/g, '/')]);
  }
}
console.log(`Done. ${executables.length} executable files.`);
