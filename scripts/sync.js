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
const GRAUT = path.join(ROOT, 'skills', 'graut');
const PACKS = path.join(GRAUT, 'packs');
const LIBRARY = path.join(GRAUT, 'library');
const NOTE =
  '> `<skill-dir>` below is the folder that contains this file. Use its real path in commands. (Path edited by Graut.)';

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

// A file called SKILL.md is picked up by agents as its own skill, wherever it sits. Packs are
// called PACK.md so that agents list only Graut, and links to them are updated to match.
function pack(dir) {
  for (const file of walk(dir)) {
    if (file.endsWith('.md')) {
      const old = fs.readFileSync(file, 'utf8');
      const text = old.replace(/(\]\((?!https?:)[^)\s]*)SKILL\.md/g, '$1PACK.md');
      if (text !== old) fs.writeFileSync(file, text);
    }
    if (path.basename(file) === 'SKILL.md') fs.renameSync(file, path.join(path.dirname(file), 'PACK.md'));
  }
}

function patch(file, replacements) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to] of Object.entries(replacements)) {
    if (!text.includes(from)) throw new Error(`patch no longer applies to ${file}: ${from}`);
    text = text.split(from).join(to);
  }
  if (path.basename(file) === 'PACK.md') text = text.replace(/^(---\n[\s\S]*?\n---\n)/, `$1\n${NOTE}\n`);
  fs.writeFileSync(file, text);
}

const executables = [];
fs.rmSync(PACKS, { recursive: true, force: true });
fs.rmSync(LIBRARY, { recursive: true, force: true });

for (const source of loadManifest().sources) {
  console.log(source.repo);
  const skills = Object.entries(source.skills || {});
  const library = source.library || [];
  const repo = fetchSource(source, [...library, ...skills.flatMap(([, from]) => [].concat(from))]);
  const modes = execFileSync('git', ['-C', repo, 'ls-files', '-s'], { encoding: 'utf8', maxBuffer: 1 << 28 });

  for (const [name, from] of skills) {
    const stage = stageSkill(source, repo, name, from);
    const dest = path.join(PACKS, name);
    // coverage data and caches are build leftovers, not part of a skill
    fs.cpSync(stage, dest, { recursive: true, filter: (f) => !/(^|[\\/])(\.coverage|__pycache__|\.gitignore)$/.test(f) });
    pack(dest);
    for (const line of modes.split('\n').filter((l) => l.startsWith('100755'))) {
      const file = line.split('\t')[1];
      for (const item of [].concat(from)) {
        const inside = Array.isArray(from) ? path.basename(item) : '';
        if (file.startsWith(`${item}/`)) executables.push(path.join(dest, inside, file.slice(item.length + 1)));
      }
    }
  }
  // for a repo without a license file: the license of the project whose text the skill carries
  if (source.licenseFrom) {
    const license = path.join(fetchSource(source.licenseFrom, []), 'LICENSE');
    for (const [name] of skills) fs.copyFileSync(license, path.join(PACKS, name, 'UPSTREAM-LICENSE'));
  }
  for (const [file, replacements] of Object.entries(source.patch || {})) patch(path.join(PACKS, file), replacements);
  // files Graut adds beside a skill's own
  for (const [file, text] of Object.entries(source.add || {})) fs.writeFileSync(path.join(PACKS, file), text);

  // Search lists and reference docs: text only, so pictures do not bloat the repo.
  if (library.length) {
    const dest = path.join(LIBRARY, source.id);
    for (const item of library) {
      fs.cpSync(path.join(repo, item), path.join(dest, item), {
        recursive: true,
        filter: (f) => fs.statSync(f).isDirectory() || /\.(md|json)$/.test(f),
      });
    }
    pack(dest);
    for (const file of fs.readdirSync(repo).filter((f) => /^(LICENSE|NOTICE)/i.test(f))) {
      fs.cpSync(path.join(repo, file), path.join(dest, `UPSTREAM-${file}`));
    }
  }
}

// Windows does not record the executable bit, so it is set in the git index.
if (fs.existsSync(path.join(ROOT, '.git'))) {
  for (const file of executables) {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    execFileSync('git', ['-C', ROOT, 'update-index', '--add', '--chmod=+x', relative]);
  }
}
require('./commands.js');
console.log(`Done. ${executables.length} executable files.`);
