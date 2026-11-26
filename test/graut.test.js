'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SKILLS = path.join(__dirname, '..', 'skills');
const manifestOf = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// Offline sandbox: a copy of the graut skill with two fake bundled skills beside it,
// and a local git repo standing in for the catalog.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graut-test-'));
const home = path.join(tmp, 'home');
const bundle = path.join(tmp, 'bundle');
const upstream = path.join(tmp, 'upstream');
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const skill = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`;

fs.cpSync(path.join(SKILLS, 'graut', 'scripts'), path.join(bundle, 'graut', 'scripts'), { recursive: true });
write(path.join(bundle, 'graut', 'SKILL.md'), skill('graut', 'master'));
for (const name of ['alpha', 'mine']) {
  write(path.join(bundle, name, 'SKILL.md'), skill(name, 'bundled'));
  write(path.join(bundle, name, 'UPSTREAM-LICENSE'), 'MIT');
}
const index = JSON.stringify([
  { id: 'extra', name: 'extra', path: 'skills/extra', description: 'pdf tables', risk: 'safe' },
  { id: 'evil', name: 'evil', path: 'skills/../../escape', description: 'x', risk: 'safe' },
]);
write(path.join(bundle, 'graut', 'library', 'cat', 'skills_index.json'), index);

write(path.join(upstream, 'skills', 'extra', 'SKILL.md'), skill('extra', 'pdf tables'));
write(path.join(upstream, 'LICENSE'), 'MIT');
const git = (...args) => execFileSync('git', ['-C', upstream, ...args], { encoding: 'utf8' }).trim();
git('init', '-q');
git('add', '.');
git('-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qm', 'seed');

const manifest = path.join(tmp, 'sources.json');
write(
  manifest,
  JSON.stringify({
    catalog: 'cat',
    sources: [
      { id: 'one', repo: upstream, sha: 'unused', skills: { alpha: 'skills/alpha', mine: 'skills/mine' } },
      { id: 'cat', repo: upstream, sha: git('rev-parse', 'HEAD'), library: [] },
    ],
  })
);

const graut = (...args) =>
  spawnSync(process.execPath, [path.join(bundle, 'graut', 'scripts', 'graut.js'), ...args], {
    cwd: tmp,
    encoding: 'utf8',
    env: { ...process.env, GRAUT_HOME: home, GRAUT_SOURCES: manifest },
  });
const installed = path.join(home, '.claude', 'skills');
const memory = path.join(home, '.claude', 'CLAUDE.md');
const flags = ['--agents', 'claude', '--no-system-deps'];

write(path.join(installed, 'mine', 'SKILL.md'), skill('mine', 'user zebra version'));
write(memory, 'my own rules\n');
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('install copies bundled skills, keeps the user copy, activates once', () => {
  for (let run = 0; run < 2; run++) {
    const r = graut('install', ...flags);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Tention mat le, teri problem me graut bhar denge/);
  }
  for (const name of ['graut', 'alpha']) assert.ok(fs.existsSync(path.join(installed, name, '.graut')), name);
  assert.match(read(installed, 'mine', 'SKILL.md'), /zebra/);
  assert.strictEqual(read(memory).match(/graut:start/g).length, 1);
  assert.strictEqual(read(`${memory}.graut.bak`), 'my own rules\n');
});

test('find searches skills on this machine and the catalog', () => {
  assert.match(graut('find', 'zebra').stdout, /Already on this machine[\s\S]*mine/);
  assert.match(graut('find', 'pdf').stdout, /In the catalog[\s\S]*extra/);
});

test('add installs a catalog skill only past the scan or on request', () => {
  // a scanner that is absent or fails must not silently install a catalog skill
  const first = graut('add', 'extra', '--agents', 'claude');
  if (first.status !== 0) {
    assert.match(first.stdout, /par isse kam nhi chalega/);
    assert.ok(!fs.existsSync(path.join(installed, 'extra')));
    const forced = graut('add', 'extra', '--agents', 'claude', '--allow-risky');
    assert.strictEqual(forced.status, 0, forced.stdout + forced.stderr);
  }
  assert.ok(fs.existsSync(path.join(installed, 'extra', 'UPSTREAM-LICENSE')));
});

test('add refuses unknown ids and paths that escape', () => {
  assert.notStrictEqual(graut('add', 'nope').status, 0);
  const r = graut('add', 'evil', '--allow-risky');
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /unsafe path/);
});

test('unknown agent is rejected', () => {
  assert.match(graut('install', '--agents', 'clippy').stderr, /unknown agent/);
});

test('uninstall removes only what Graut added', () => {
  assert.strictEqual(graut('uninstall').status, 0);
  assert.deepStrictEqual(fs.readdirSync(installed), ['mine']);
  assert.strictEqual(read(memory), 'my own rules\n');
});

test('every bundled skill is complete', () => {
  const { sources } = manifestOf(path.join(SKILLS, 'graut', 'sources.json'));
  const names = sources.flatMap((s) => Object.keys(s.skills || {}));
  assert.strictEqual(names.length, 34);
  const router = read(SKILLS, 'graut', 'SKILL.md');
  for (const name of names) {
    assert.match(read(SKILLS, name, 'SKILL.md'), new RegExp(`^---[\\s\\S]*?\\nname: *["']?${name}\\b`), name);
    assert.ok(fs.existsSync(path.join(SKILLS, name, 'UPSTREAM-LICENSE')), `${name} license`);
    assert.ok(router.includes(`\`${name}\``) || name.startsWith('ponytail-'), `router does not mention ${name}`);
    assert.ok(!read(SKILLS, name, 'SKILL.md').includes('CLAUDE_PLUGIN_ROOT}/.claude'), `${name} path`);
  }
  for (const source of sources.filter((s) => s.library)) {
    for (const item of source.library) {
      assert.ok(fs.existsSync(path.join(SKILLS, 'graut', 'library', source.id, item)), `${source.id}/${item}`);
    }
  }
});
