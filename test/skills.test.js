'use strict';
// Every bundled skill on this system: its instructions load, its scripts parse, and the tools that
// need no account or download really run. Works on a throwaway copy. Run with: npm run test:skills
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE = path.join(__dirname, '..', 'skills', 'graut', 'packs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graut-skills-'));
const P = path.join(tmp, 'packs');
const W = path.join(tmp, 'work');
fs.cpSync(SOURCE, P, { recursive: true });
fs.mkdirSync(W);
test.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 8 }));

const packs = fs.readdirSync(P).filter((name) => fs.statSync(path.join(P, name)).isDirectory());
const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: W, encoding: 'utf8', timeout: 180000, env: { ...process.env, DO_NOT_TRACK: '1', PYTHONDONTWRITEBYTECODE: '1' }, ...opts });
const python = ['python3', 'python'].find((p) => run(p, ['-c', 'import sys; sys.exit(sys.version_info[0] != 3)']).status === 0);
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

function files(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files(file, found);
    } else found.push(file);
  }
  return found;
}
const scripts = files(P);

test('all 36 skills have instructions with their own name and a description', () => {
  assert.strictEqual(packs.length, 36);
  for (const name of packs) {
    const head = fs.readFileSync(path.join(P, name, 'PACK.md'), 'utf8').split(/^---\s*$/m)[1] || '';
    assert.match(head, /^name:\s*\S+/m, name);
    assert.match(head, /^description:/m, name);
  }
});

test('every Python script in every skill parses', () => {
  assert.ok(python, 'Python 3 is needed');
  const list = path.join(tmp, 'py.txt');
  fs.writeFileSync(list, scripts.filter((f) => f.endsWith('.py')).join('\n'));
  const code = [
    'import sys',
    'bad = []',
    'for f in open(sys.argv[1], encoding="utf-8").read().splitlines():',
    '    try: compile(open(f, "rb").read(), f, "exec")',
    '    except SyntaxError as e: bad.append(f"{f}: {e}")',
    'print("\\n".join(bad))',
    'sys.exit(bool(bad))',
  ].join('\n');
  const r = run(python, ['-c', code, list]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('every JavaScript file in every skill parses', () => {
  const bad = [];
  for (const file of scripts.filter((f) => /\.(c|m)?js$/.test(f))) {
    if (run(process.execPath, ['--check', file]).status === 0) continue;
    // a module in a folder that does not declare itself one
    const asModule = run(process.execPath, ['--check', '--input-type=module'], { input: fs.readFileSync(file) });
    if (asModule.status !== 0) bad.push(`${path.relative(P, file)}: ${asModule.stderr.split('\n').find((l) => /Error/.test(l))}`);
  }
  assert.deepStrictEqual(bad, []);
});

test('every shell script in every skill parses', () => {
  const bash = process.platform === 'win32' ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe') : 'bash';
  const shells = scripts.filter((f) => {
    if (f.endsWith('.sh')) return true;
    if (path.extname(f)) return false;
    return /^#!.*\b(ba)?sh\b/.test(fs.readFileSync(f, 'utf8').split('\n')[0]);
  });
  assert.ok(shells.length > 0);
  for (const file of shells) {
    const r = run(bash, ['-n', file.split(path.sep).join('/')]);
    assert.strictEqual(r.status, 0, `${path.relative(P, file)}: ${r.stderr}`);
  }
});

// Inputs the tools below read.
write(path.join(W, 'src', 'a.css'), 'a { color: #123456 }\n');
write(path.join(W, 'project', 'app.py'), 'def add(a, b):\n    return a + b\n');
write(path.join(W, 'project', 'pyproject.toml'), '[project]\nname = "x"\n');
write(path.join(W, 's.srt'), '1\n00:00:00,000 --> 00:00:01,000\nnamaste\n');
write(path.join(W, 'tokens.json'), JSON.stringify({ primitive: { color: { blue: { 500: { $value: '#3366ff', $type: 'color' } } } }, semantic: {}, component: {} }));
fs.mkdirSync(path.join(W, 'docs'), { recursive: true });
fs.copyFileSync(path.join(P, 'brand', 'references', 'brand-guideline-template.md'), path.join(W, 'docs', 'brand-guidelines.md'));
fs.copyFileSync(path.join(__dirname, '..', 'assets', 'icon.jpg'), path.join(W, 'avatar.jpg'));

const py = (script, ...args) => [() => python, [path.join(P, script), ...args]];
const node = (script, ...args) => [() => process.execPath, [path.join(P, script), ...args]];
const work = (...p) => path.join(W, ...p);
// [skill, what, command, what it prints, exit code, a file it must make]
const TOOLS = [
  ['ui-ux-pro-max', 'design system search', py('ui-ux-pro-max/scripts/search.py', 'chai shop ordering', '--design-system'), /style|pattern/i],
  ['ui-ux-pro-max', 'stack search', py('ui-ux-pro-max/scripts/search.py', 'form accessibility', '--stack', 'react'), /\S{3}/],
  ['design', 'logo brief', py('design/scripts/logo/search.py', 'tech startup', '--design-brief', '-p', 'Demo'), /demo/i],
  ['design', 'identity brief', py('design/scripts/cip/search.py', 'coffee shop', '--cip-brief', '-b', 'Demo'), /demo/i],
  ['design-system', 'slide search', py('design-system/scripts/search-slides.py', 'investor pitch'), /\S{3}/],
  ['design-system', 'tokens to CSS', node('design-system/scripts/generate-tokens.cjs', '--config', work('tokens.json'), '-o', work('tokens.css')), /./, 0, 'tokens.css'],
  // it exits 1 because the sample holds a hardcoded colour
  ['design-system', 'token check', node('design-system/scripts/validate-tokens.cjs', '--dir', work('src')), /hex color/i, 1],
  ['slides', 'slide copy search', py('design-system/scripts/search-slides.py', 'problem agitation', '-d', 'copy'), /\S{3}/],
  ['brand', 'brand context', node('brand/scripts/inject-brand-context.cjs', '--json'), /colors/],
  ['brand', 'palette', node('brand/scripts/extract-colors.cjs', '--palette'), /PALETTE/],
  ['ui-styling', 'Tailwind config', py('ui-styling/scripts/tailwind_config_gen.py', '--colors', 'brand:blue', '--fonts', 'display:Inter', '--output', work('tailwind.config.ts')), /./, 0, 'tailwind.config.ts'],
  ['ui-styling', 'component helper', py('ui-styling/scripts/shadcn_add.py', '--help'), /usage/i],
  ['gravitas', 'project detection', py('gravitas/scripts/detect_project.py', work('project')), /"language": "python"/],
  ['gravitas', 'verify helper', py('gravitas/scripts/verify.py', '--help'), /usage/i],
  ['huashu-nuwa', 'subtitles to transcript', py('huashu-nuwa/scripts/srt_to_transcript.py', work('s.srt'), work('transcript.txt')), /./, 0, 'transcript.txt'],
  ['x-posting-license', 'video project', node('x-posting-license/scripts/build.mjs', '--out', work('license'), '--name', 'Demo', '--handle', 'demo', '--joined', 'JAN 2026', '--followers', '1', '--following', '2', '--posts', '3', '--bio', 'hi', '--avatar', work('avatar.jpg')), /built/, 0, 'license/index.html'],
  ['duo', 'video project', node('duo/scripts/build.mjs', '--out', work('duo'), '--duration', '5'), /composition/, 0, 'duo/index.html'],
  ['vox-explainer', 'transition checker', node('vox-explainer/scripts/seam-gate.mjs'), /usage/i, 2],
  ['prod-by-claude', 'music video project', node('prod-by-claude/scripts/new-project.mjs', work('track')), /./, 0, 'track'],
];

for (const [skill, what, [command, args], prints, code = 0, makes] of TOOLS) {
  test(`${skill}: ${what}`, () => {
    const r = run(command(), args);
    const output = `${r.stdout}${r.stderr}`;
    assert.strictEqual(r.status, code, output.slice(-1500));
    assert.match(output, prints);
    if (makes) assert.ok(fs.existsSync(work(makes)), `${makes} was not made`);
  });
}
