// Everything the bundled skills need beyond their own files, checked and installed in one place.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const codegraph = require('./context.js');

const WINDOWS = process.platform === 'win32';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const works = (cmd, args, opts) => run(cmd, args, { stdio: 'ignore', ...opts }).status === 0;
// npm, npx and some installs of claude are .cmd files, which Windows only runs through cmd.
const shell = (cmd, args, opts) => (WINDOWS ? run('cmd.exe', ['/d', '/c', cmd, ...args], opts) : run(cmd, args, opts));
// Graut itself usually runs under npx, which passes its settings down in npm_* variables.
// A second npm or npx that inherits them looks for the wrong package, so they are removed.
const npm = (cmd, args, opts) => {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_/i.test(key)));
  return shell(cmd, args, { ...opts, env: clean });
};

// [command, version flag, winget id, brew name, apt/manual hint, skills that need it]
const TOOLS = {
  git: ['git', '--version', 'Git.Git', 'git', 'sudo apt install git', 'add, cloning'],
  uv: ['uv', '--version', 'astral-sh.uv', 'uv', 'install uv: https://docs.astral.sh/uv/', 'skill-inspector'],
  python: ['python', '--version', 'Python.Python.3.13', 'python', 'sudo apt install python3', 'design skills, gravitas, huashu-nuwa'],
  ffmpeg: ['ffmpeg', '-version', 'Gyan.FFmpeg.Essentials', 'ffmpeg', 'sudo apt install ffmpeg', 'brag, hyperframes and every video skill'],
};
// a global npm install needs administrator rights on most Linux setups
const CODEGRAPH_FIX = `${process.platform === 'linux' ? 'sudo ' : ''}${codegraph.INSTALL}`;
// import name -> pip name
const MODULES = { numpy: 'numpy', scipy: 'scipy', PIL: 'pillow', 'google.genai': 'google-genai' };

function python() {
  return ['python3', 'python'].find((p) => works(p, ['-c', 'import sys; sys.exit(sys.version_info[0] != 3)'])) || null;
}

const hasTool = (name) => (name === 'python' ? Boolean(python()) : works(TOOLS[name][0], [TOOLS[name][1]]));

function fixFor(name) {
  const [, , wingetId, brewName, other] = TOOLS[name];
  if (WINDOWS) return `winget install --id ${wingetId} -e`;
  if (process.platform === 'darwin') return `brew install ${brewName}`;
  return other;
}

// Installs a missing tool through winget or brew, only with a person at the terminal to accept prompts.
function ensureTool(name, autoInstall) {
  if (hasTool(name)) return true;
  const manager = { win32: 'winget', darwin: 'brew' }[process.platform];
  if (autoInstall && manager && process.stdin.isTTY && works(manager, ['--version'])) {
    console.log(`\nInstalling ${name} ...`);
    run(manager, fixFor(name).split(' ').slice(1), { stdio: 'inherit' });
  }
  return hasTool(name);
}

// Several skills call `python3`. On Windows that name is usually a Microsoft Store placeholder,
// so a real python3.exe is placed beside python.exe. Returns the file it created, if any.
function addPython3() {
  if (!WINDOWS || works('python3', ['-c', ''])) return null;
  const exe = run('python', ['-c', 'import sys; print(sys.executable)']).stdout?.trim();
  if (!exe) return null;
  const copy = path.join(path.dirname(exe), 'python3.exe');
  if (fs.existsSync(copy)) return null;
  fs.copyFileSync(exe, copy);
  return copy;
}

function missingModules(py) {
  const code = `import importlib\nfor m in ${JSON.stringify(Object.keys(MODULES))}:\n    try: importlib.import_module(m)\n    except Exception: print(m)`;
  const r = run(py, ['-c', code]);
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean).map((m) => MODULES[m]) : Object.values(MODULES);
}

// Linux and Homebrew Pythons refuse pip installs unless told otherwise; that choice is left to the user.
function pipCommand(py, names) {
  const code = "import os, sysconfig; print(os.path.exists(os.path.join(sysconfig.get_path('stdlib'), 'EXTERNALLY-MANAGED')))";
  const managed = run(py, ['-c', code]).stdout?.trim() === 'True';
  return `${py} -m pip install --user ${managed ? '--break-system-packages ' : ''}${names.join(' ')}`;
}

function installModules(py, names) {
  const pip = (extra, stdio) =>
    run(py, ['-m', 'pip', 'install', '--quiet', ...extra, ...names], { stdio }).status === 0;
  // --user is refused inside a virtual environment, so fall back to a plain install there
  return pip(['--user'], 'ignore') || pip([], 'inherit');
}

// Skill folders that carry their own Node packages and do not have them yet.
function nodeFolders(packs) {
  if (!fs.existsSync(packs)) return [];
  return fs
    .readdirSync(packs)
    .map((name) => path.join(packs, name, 'scripts'))
    .filter((dir) => fs.existsSync(path.join(dir, 'package.json')) && !fs.existsSync(path.join(dir, 'node_modules')));
}

// The design engine is one program, downloaded once into ~/.impeccable and checked against a pinned hash.
function engine(packs, args, opts) {
  const launcher = path.join(packs, 'impeccable', 'scripts', WINDOWS ? 'impeccable.cmd' : 'impeccable');
  if (!fs.existsSync(launcher)) return null;
  return WINDOWS
    ? run('cmd.exe', ['/d', '/s', '/c', `""${launcher}" ${args}"`], { windowsVerbatimArguments: true, ...opts })
    : run('sh', [launcher, ...args.split(' ')], opts);
}

// Installs what is missing for the skills in these folders. Returns what the user still has to do.
function prepare(packsFolders, remember) {
  const todo = [];
  const step = (label, ok, fix) => {
    console.log(`  ${ok ? 'ok     ' : 'MISSING'} ${label}`);
    if (!ok && fix) todo.push(fix);
  };
  console.log('\nSetting up what the skills need. The first time takes a few minutes.');

  const py = python();
  if (py) {
    const created = addPython3();
    if (created) remember(created);
    if (WINDOWS) step('python3 command', works('python3', ['-c', '']), 'use `python` wherever a skill says `python3`');
    let missing = missingModules(py);
    if (missing.length) installModules(py, missing);
    missing = missingModules(py);
    step('Python packages', !missing.length, missing.length && pipCommand(py, missing));
  }

  for (const folder of packsFolders.flatMap(nodeFolders)) {
    console.log(`  installing packages for ${path.basename(path.dirname(folder))} ...`);
    // `ci` installs exactly the lock file, where the skill ships one
    const verb = fs.existsSync(path.join(folder, 'package-lock.json')) ? 'ci' : 'install';
    const ok = npm('npm', [verb, '--no-audit', '--no-fund', '--loglevel=error'], { cwd: folder, stdio: 'inherit' }).status === 0;
    step(`packages for ${path.basename(path.dirname(folder))}`, ok, `run npm ${verb} in ${folder}`);
  }

  const packs = packsFolders.find((p) => fs.existsSync(path.join(p, 'impeccable')));
  if (packs) {
    console.log('  fetching the design engine ...');
    step('design engine (impeccable)', engine(packs, '--version', { timeout: 300000 })?.status === 0, 'check your connection, then run install again');
  }

  if (!codegraph.installed()) {
    console.log('  installing CodeGraph for code context (about 280 MB) ...');
    const args = ['install', '-g', '--no-audit', '--no-fund', '--loglevel=error', codegraph.PACKAGE];
    npm('npm', args, { cwd: os.tmpdir(), stdio: 'inherit', timeout: 600000 });
  }
  step('CodeGraph (code context)', codegraph.installed(), CODEGRAPH_FIX);

  console.log('  fetching the video tool ...');
  const video = npm('npx', ['--yes', 'hyperframes@latest', '--version'], { timeout: 300000 }).status === 0;
  step('video tool (hyperframes)', video, 'check your connection, then run: npx --yes hyperframes@latest --version');
  return todo;
}

// What `doctor` reports: each requirement, and which skills depend on it.
function report(packsFolders) {
  const todo = [];
  const line = (ok, label, users, fix) => {
    console.log(`${ok ? 'ok     ' : 'MISSING'} ${label}  (${users})`);
    if (!ok) todo.push(fix);
  };
  for (const [name, spec] of Object.entries(TOOLS)) line(hasTool(name), name, spec[5], fixFor(name));
  const py = python();
  if (py) {
    if (WINDOWS) line(works('python3', ['-c', '']), 'python3 command', 'skills that call python3', 'run install again');
    const missing = missingModules(py);
    line(!missing.length, 'Python packages', 'design, day-in-my-life', missing.length && pipCommand(py, missing));
  }
  line(codegraph.installed(), 'CodeGraph', 'code context for every /graut call', CODEGRAPH_FIX);
  const bare = packsFolders.flatMap(nodeFolders);
  line(!bare.length, 'skill packages', 'day-in-my-life, session-story, p5-paint-animation', 'run install again');
  line(Number(process.versions.node.split('.')[0]) >= 22, 'Node.js 22 or newer', 'video skills', 'upgrade Node.js');
  console.log('note    GEMINI_API_KEY is needed only for image generation in `design`' + (process.env.GEMINI_API_KEY ? ' (set)' : ' (not set)'));
  return todo;
}

module.exports = { run, works, shell, npm, TOOLS, hasTool, fixFor, ensureTool, addPython3, prepare, report };
