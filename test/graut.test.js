'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GRAUT = path.join(ROOT, 'skills', 'graut');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// Offline sandbox: a copy of the graut skill holding two fake packs,
// and a local git repo standing in for the catalog.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graut-test-'));
const home = path.join(tmp, 'home');
const pkg = path.join(tmp, 'pkg'); // laid out like the published package
const bundle = path.join(pkg, 'skills', 'graut');
const upstream = path.join(tmp, 'upstream');
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const skill = (name, description) => `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`;

fs.cpSync(path.join(GRAUT, 'scripts'), path.join(bundle, 'scripts'), { recursive: true });
write(path.join(bundle, 'SKILL.md'), skill('graut', 'master'));
fs.copyFileSync(path.join(GRAUT, 'levels.json'), path.join(bundle, 'levels.json'));
write(path.join(bundle, 'packs', 'alpha', 'PACK.md'), skill('alpha', 'makes walrus things'));
write(path.join(bundle, 'packs', 'beta', 'PACK.md'), skill('beta', 'bundled'));
// as it arrives from a package published on Windows: not marked runnable
write(path.join(bundle, 'packs', 'alpha', 'scripts', 'run'), '#!/bin/sh\necho ran\n');
const index = JSON.stringify([
  { id: 'extra', name: 'extra', path: 'skills/extra', description: 'pdf tables', risk: 'safe' },
  { id: 'evil', name: 'evil', path: 'skills/../../escape', description: 'x', risk: 'safe' },
]);
write(path.join(bundle, 'library', 'cat', 'skills_index.json'), index);

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
      { id: 'one', repo: upstream, sha: 'unused', skills: { alpha: 'skills/alpha', beta: 'skills/beta' } },
      { id: 'cat', repo: upstream, sha: git('rev-parse', 'HEAD'), library: [] },
    ],
  })
);

// A scanner installed on this machine must not change the results, so the sandbox cannot see one.
const hasScanner = (dir) => ['skillspector', 'skillspector.exe'].some((f) => fs.existsSync(path.join(dir, f)));
const sandbox = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH'));
Object.assign(sandbox, {
  PATH: (process.env.PATH || '').split(path.delimiter).filter((d) => d && !hasScanner(d)).join(path.delimiter),
  UV_TOOL_BIN_DIR: path.join(tmp, 'no-tools'),
  GRAUT_HOME: home,
  GRAUT_SOURCES: manifest,
});

const graut = (...args) =>
  spawnSync(process.execPath, [path.join(bundle, 'scripts', 'graut.js'), ...args], {
    cwd: tmp,
    encoding: 'utf8',
    env: sandbox,
  });
const claude = path.join(home, '.claude', 'skills');
const codex = path.join(home, '.agents', 'skills');
const memory = path.join(home, '.claude', 'CLAUDE.md');
const flags = ['--agents', 'claude,codex', '--no-system-deps', '--no-plugin'];

// left by Graut 1.0, which installed each specialist separately
write(path.join(claude, 'alpha', 'SKILL.md'), skill('alpha', 'old copy'));
write(path.join(claude, 'alpha', '.graut'), 'Pranjal240/Graut\n');
// the user's own skills
write(path.join(claude, 'beta', 'SKILL.md'), skill('beta', 'user zebra version'));
write(path.join(codex, 'graut', 'SKILL.md'), skill('graut', 'user graut'));
write(memory, 'my own rules\n');
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('hook tells Claude about Graut until CLAUDE.md does', () => {
  assert.match(graut('hook').stdout, /Use the `graut` skill/);
});

test('install leaves one graut skill, merges old copies and keeps user folders', () => {
  for (let run = 0; run < 2; run++) {
    const r = graut('install', ...flags);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Tention mat le, teri problem me graut bhar denge/);
  }
  assert.ok(fs.existsSync(path.join(claude, 'graut', 'packs', 'alpha', 'PACK.md')));
  if (process.platform !== 'win32') {
    const script = path.join(claude, 'graut', 'packs', 'alpha', 'scripts', 'run');
    assert.strictEqual(execFileSync(script, { encoding: 'utf8' }), 'ran\n');
  }
  assert.deepStrictEqual(fs.readdirSync(claude).sort(), ['beta', 'graut']);
  assert.match(read(claude, 'beta', 'SKILL.md'), /zebra/);
  assert.match(read(codex, 'graut', 'SKILL.md'), /user graut/);
  assert.strictEqual(read(memory).match(/graut:start/g).length, 1);
  assert.strictEqual(read(`${memory}.graut.bak`), 'my own rules\n');
  assert.strictEqual(graut('hook').stdout, '');
});

test('level changes the note in instruction files, and off removes it', () => {
  const set = (name) => graut('level', name, '--agents', 'claude');
  assert.match(graut('level').stdout, /Graut level: full/);
  assert.strictEqual(set('ultra').status, 0);
  assert.match(read(memory), /Graut level: ultra/);
  assert.strictEqual(graut('hook').stdout, '');
  set('off');
  assert.strictEqual(read(memory), 'my own rules\n');
  assert.strictEqual(graut('hook').stdout, '');
  set('lite');
  assert.match(read(memory), /Graut level: lite/);
  assert.match(set('turbo').stderr, /unknown level/);
  set('full');
});

test('find searches packs, other local skills and the catalog', () => {
  assert.match(graut('find', 'walrus').stdout, /Already on this machine[\s\S]*alpha[\s\S]*PACK\.md/);
  assert.match(graut('find', 'zebra').stdout, /beta/);
  assert.match(graut('find', 'pdf').stdout, /In the catalog[\s\S]*extra/);
});

test('add gives a catalog skill to Graut only past the scan or on request', () => {
  const added = path.join(home, '.graut', 'packs', 'extra');
  // with no scanner, a catalog skill is not added silently
  const first = graut('add', 'extra');
  assert.notStrictEqual(first.status, 0, first.stdout);
  assert.match(first.stdout, /par isse kam nhi chalega/);
  assert.ok(!fs.existsSync(added));
  const forced = graut('add', 'extra', '--allow-risky');
  assert.strictEqual(forced.status, 0, forced.stdout + forced.stderr);
  assert.ok(fs.existsSync(path.join(added, 'UPSTREAM-LICENSE')));
  assert.ok(!fs.existsSync(path.join(claude, 'extra')));
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
  assert.deepStrictEqual(fs.readdirSync(claude), ['beta']);
  assert.ok(fs.existsSync(path.join(codex, 'graut', 'SKILL.md')));
  assert.strictEqual(read(memory), 'my own rules\n');
});

test('with Claude Code present, install adds the plugin instead of a second skill copy', () => {
  const home2 = path.join(tmp, 'home2');
  const bin = path.join(tmp, 'fakebin');
  const log = path.join(tmp, 'claude.log');
  // a stand-in for the claude command that records what it was asked to do
  write(
    path.join(bin, 'claude.js'),
    `require('fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv.slice(2).join(' ') === 'plugin list') console.log('graut@graut\\nponytail@ponytail');`
  );
  write(path.join(bin, 'claude.cmd'), '@node "%~dp0claude.js" %*\r\n');
  write(path.join(bin, 'claude'), '#!/bin/sh\nexec node "$(dirname "$0")/claude.js" "$@"\n');
  fs.chmodSync(path.join(bin, 'claude'), 0o755);
  write(path.join(pkg, '.claude-plugin', 'plugin.json'), '{}');
  write(path.join(pkg, 'commands', 'alpha.md'), 'x');
  write(path.join(home2, '.claude', 'skills', 'graut', '.graut'), 'Pranjal240/Graut\n');
  const withClaude = (...args) =>
    spawnSync(process.execPath, [path.join(bundle, 'scripts', 'graut.js'), ...args], {
      cwd: tmp,
      encoding: 'utf8',
      env: { ...sandbox, GRAUT_HOME: home2, PATH: `${bin}${path.delimiter}${sandbox.PATH}` },
    });

  const r = withClaude('install', '--agents', 'claude', '--no-system-deps');
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Graut plugin installed with the panel/);
  assert.match(r.stdout, /claude plugin disable ponytail@ponytail/);
  const copy = path.join(home2, '.graut', 'plugin');
  for (const file of ['.claude-plugin/plugin.json', 'commands/alpha.md', 'skills/graut/packs/alpha/PACK.md']) {
    assert.ok(fs.existsSync(path.join(copy, file)), file);
  }
  assert.ok(!fs.existsSync(path.join(home2, '.claude', 'skills', 'graut')));
  const asked = () => read(log).trim().split('\n').map((line) => JSON.parse(line).join(' '));
  assert.ok(asked().includes(`plugin marketplace add ${copy}`), asked().join(' | '));
  assert.ok(asked().includes('plugin install graut@graut'));

  assert.strictEqual(withClaude('uninstall', '--agents', 'claude').status, 0);
  assert.ok(asked().includes('plugin uninstall graut@graut'));
  assert.ok(!fs.existsSync(copy));
});

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

test('agents see exactly one skill, and every pack inside it is complete', () => {
  const { sources } = json(path.join(GRAUT, 'sources.json'));
  const names = sources.flatMap((s) => Object.keys(s.skills || {}));
  assert.strictEqual(names.length, 36);
  assert.deepStrictEqual(fs.readdirSync(path.join(ROOT, 'skills')), ['graut']);
  const skillFiles = walk(GRAUT).filter((f) => path.basename(f) === 'SKILL.md');
  assert.deepStrictEqual(skillFiles, [path.join(GRAUT, 'SKILL.md')]);

  const router = read(GRAUT, 'SKILL.md');
  assert.deepStrictEqual(fs.readdirSync(path.join(GRAUT, 'packs')).sort(), [...names].sort());
  for (const name of names) {
    const pack = read(GRAUT, 'packs', name, 'PACK.md');
    assert.match(pack, new RegExp(`^---[\\s\\S]*?\\nname: *["']?${name}\\b`), name);
    assert.ok(fs.existsSync(path.join(GRAUT, 'packs', name, 'UPSTREAM-LICENSE')), `${name} license`);
    assert.ok(router.includes(`\`${name}\``), `router does not mention ${name}`);
    assert.ok(!pack.includes('CLAUDE_PLUGIN_ROOT}/.claude'), `${name} path`);
  }
  const playbooks = fs.readdirSync(path.join(GRAUT, 'playbooks')).sort();
  assert.deepStrictEqual(playbooks, ['ai.md', 'debug.md', 'ml.md', 'web.md']);
  for (const file of playbooks) assert.ok(router.includes(`\`${file}\``), `router does not mention ${file}`);
  assert.deepStrictEqual(Object.keys(json(path.join(GRAUT, 'levels.json'))), ['lite', 'full', 'ultra']);
  for (const source of sources.filter((s) => s.library)) {
    for (const item of source.library) {
      assert.ok(fs.existsSync(path.join(GRAUT, 'library', source.id, item)), `${source.id}/${item}`);
    }
  }
});

test('every pack has a direct command that costs no context until called', () => {
  const names = fs.readdirSync(path.join(GRAUT, 'packs'));
  assert.deepStrictEqual(fs.readdirSync(path.join(ROOT, 'commands')).sort(), names.map((n) => `${n}.md`).sort());
  for (const name of names) {
    const command = read(ROOT, 'commands', `${name}.md`);
    assert.match(command, /^---\ndescription: ".+"\n[\s\S]*?\ndisable-model-invocation: true\n---/, name);
    assert.ok(command.includes(`\${CLAUDE_PLUGIN_ROOT}/skills/graut/packs/${name}/PACK.md`), name);
  }
  assert.ok(json(path.join(ROOT, 'package.json')).files.includes('commands'));
});

test('links inside the packs lead to files that exist', () => {
  const broken = [];
  for (const file of walk(path.join(GRAUT, 'packs')).filter((f) => f.endsWith('.md'))) {
    const prose = fs.readFileSync(file, 'utf8').replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
    for (const [, link] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = link.split(/[#?]/)[0];
      // skip web links, template placeholders and words that are not file names
      if (!target || /^([a-z]+:|\/)|[<>{}$*]/.test(target) || !/\.[A-Za-z0-9]{1,5}$|\//.test(target)) continue;
      if (!fs.existsSync(path.join(path.dirname(file), target))) broken.push(`${path.relative(GRAUT, file)} -> ${link}`);
    }
  }
  assert.deepStrictEqual(broken, []);
});

test('release versions agree and the plugin hook points at the script', () => {
  const version = json(path.join(ROOT, 'package.json')).version;
  assert.strictEqual(json(path.join(ROOT, '.claude-plugin', 'plugin.json')).version, version);
  assert.match(read(ROOT, 'hooks', 'hooks.json'), /skills\/graut\/scripts\/graut\.js\\" hook/);
});

test('upgrade installs the newest release and refreshes a global install', () => {
  const bin = path.join(tmp, 'fakenpm');
  const log = path.join(tmp, 'npm.log');
  for (const name of ['npm', 'npx']) {
    write(
      path.join(bin, `${name}.js`),
      `require('fs').appendFileSync(${JSON.stringify(log)}, ['${name}', ...process.argv.slice(2)].join(' ') + '\\n');
if (process.argv[2] === 'view') console.log('9.8.7');`
    );
    write(path.join(bin, `${name}.cmd`), `@node "%~dp0${name}.js" %*
`);
    write(path.join(bin, name), `#!/bin/sh
exec "${process.execPath}" "$(dirname "$0")/${name}.js" "$@"
`);
    fs.chmodSync(path.join(bin, name), 0o755);
  }
  const key = Object.keys(sandbox).find((k) => k.toUpperCase() === 'PATH');
  const r = spawnSync(process.execPath, [path.join(bundle, 'scripts', 'graut.js'), 'upgrade', '--agents', 'claude,codex', '--no-activate'], {
    cwd: tmp,
    encoding: 'utf8',
    env: { ...sandbox, [key]: `${bin}${path.delimiter}${sandbox[key]}` },
  });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  const asked = read(log).trim().split('\n');
  assert.ok(asked.includes('npm install -g graut-bhar-de@9.8.7'), asked.join(' | '));
  assert.ok(asked.includes('npx --yes graut-bhar-de@9.8.7 install --agents claude,codex --no-activate'), asked.join(' | '));
  assert.strictEqual(graut('upgrade', '--agents', 'x&y').status, 1);
});

// macOS and Linux get these modes from git clone and from the plugin install.
test('every script that starts with #! is runnable in git', { skip: !fs.existsSync(path.join(ROOT, '.git')) }, () => {
  const listed = execFileSync('git', ['-C', ROOT, 'ls-files', '-s', '-z'], { encoding: 'utf8', maxBuffer: 1e8 });
  const wrong = listed
    .split('\0')
    .filter((line) => line.startsWith('100644'))
    .map((line) => line.split('\t')[1])
    .filter((file) => read(ROOT, file).startsWith('#!'));
  assert.deepStrictEqual(wrong, []);
});
