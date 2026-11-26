#!/usr/bin/env node
// Writes one Claude Code command per bundled skill, so each can be called directly (/graut:impeccable).
// Run by `npm run sync`.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PACKS = path.join(ROOT, 'skills', 'graut', 'packs');
const COMMANDS = path.join(ROOT, 'commands');

function description(name) {
  const head = fs.readFileSync(path.join(PACKS, name, 'PACK.md'), 'utf8').split(/^---\s*$/m)[1] || '';
  const found = /^description:[ \t]*[>|]?-?(.*(?:\r?\n[ \t]+.*)*)/m.exec(head);
  const text = (found ? found[1] : name).replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
  const sentence = text.split(/(?<=[.。])\s/)[0];
  return sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}...` : sentence;
}

// Only the user can call these (disable-model-invocation), so they add nothing to every session's context.
const command = (name) => `---
description: ${JSON.stringify(description(name))}
argument-hint: "[task]"
disable-model-invocation: true
---

Read \`\${CLAUDE_PLUGIN_ROOT}/skills/graut/packs/${name}/PACK.md\` and follow it for the request below.
Paths inside it are relative to its folder. Where it names another skill, read that skill's \`PACK.md\` beside it.
On Windows, if \`python3\` fails, run \`python\`.

Start with the line: Tention mat le, teri problem me graut bhar denge

Request: $ARGUMENTS
`;

fs.rmSync(COMMANDS, { recursive: true, force: true });
fs.mkdirSync(COMMANDS);
const names = fs.readdirSync(PACKS);
for (const name of names) fs.writeFileSync(path.join(COMMANDS, `${name}.md`), command(name));
console.log(`${names.length} commands written.`);
