#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { parseArgs } = require('util');

const SKILL_DIR = path.dirname(__dirname);
// The specialists live inside Graut as PACK.md files, so agents list one skill and load the rest on demand.
const PACKS = path.join(SKILL_DIR, 'packs');
const TAG = 'Pranjal240/Graut'; // written into the marker of everything Graut installs
// GRAUT_HOME points everything at a sandbox (used by tests); agent env overrides are ignored then.
const HOME = process.env.GRAUT_HOME || os.homedir();
const env = (name) => (process.env.GRAUT_HOME ? undefined : process.env[name]);
const at = (...p) => path.join(HOME, ...p);
const CLAUDE = env('CLAUDE_CONFIG_DIR') || at('.claude');
const CODEX = env('CODEX_HOME') || at('.codex');
const CONFIG = env('XDG_CONFIG_HOME') || at('.config');
const VENDOR = at('.graut', 'vendor');
const ADDED = at('.graut', 'packs'); // catalog skills the user added; only Graut reads this folder
const STAGE = at('.graut', 'staging');
const MANIFEST = process.env.GRAUT_SOURCES || path.join(SKILL_DIR, 'sources.json');
const CMD = 'npx graut-bhar-de';

const SAY = {
  start: 'Tention mat le, teri problem me graut bhar denge',
  need: (what) => `teri problem me graut to bhar diya, par isse kam nhi chalega (do this: ${what})`,
  done: 'le bhai isme graut bhardiya',
  help: 'Isme Graut bhar denge',
};

// detect: paths that prove the agent exists. memory: global instruction file, loaded every session.
const AGENTS = {
  claude: { detect: [CLAUDE], skills: path.join(CLAUDE, 'skills'), memory: path.join(CLAUDE, 'CLAUDE.md') },
  codex: { detect: [CODEX], skills: at('.agents', 'skills'), memory: path.join(CODEX, 'AGENTS.md') },
  antigravity: {
    detect: ['antigravity', 'antigravity-cli', 'antigravity-ide'].map((d) => at('.gemini', d)),
    skills: at('.gemini', 'config', 'skills'),
    memory: at('.gemini', 'GEMINI.md'),
  },
  gemini: { detect: [at('.gemini', 'settings.json')], skills: at('.gemini', 'skills'), memory: at('.gemini', 'GEMINI.md') },
  cursor: { detect: [at('.cursor')], skills: at('.cursor', 'skills') },
  opencode: { detect: [path.join(CONFIG, 'opencode')], skills: path.join(CONFIG, 'opencode', 'skills') },
  copilot: { detect: [at('.copilot')], skills: at('.copilot', 'skills') },
  windsurf: { detect: [at('.codeium', 'windsurf')], skills: at('.codeium', 'windsurf', 'skills') },
  kiro: { detect: [at('.kiro')], skills: at('.kiro', 'skills') },
};

const BLOCK_RE = /<!-- graut:start -->[\s\S]*?<!-- graut:end -->(\r?\n)?/;
// How hard Graut works. The panel in Claude Code and the `level` command both write this file.
const LEVELS = ['off', 'lite', 'full', 'ultra'];
const LEVEL_FILE = at('.graut', 'level');
const savedLevel = () => {
  const text = fs.existsSync(LEVEL_FILE) ? fs.readFileSync(LEVEL_FILE, 'utf8').trim() : '';
  return LEVELS.includes(text) ? text : 'full';
};
// The always-on note for an agent at a level; none when Graut is off.
const block = (level) => {
  if (level === 'off') return '';
  const rules = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'levels.json'), 'utf8'));
  return `<!-- graut:start -->\n## Graut\n${rules[level]}\n<!-- graut:end -->`;
};

// [command, version flag, winget id, brew name, apt/manual hint]
const TOOLS = {
  git: ['git', '--version', 'Git.Git', 'git', 'sudo apt install git'],
  uv: ['uv', '--version', 'astral-sh.uv', 'uv', 'install uv: https://docs.astral.sh/uv/'],
  python: ['python', '--version', 'Python.Python.3.13', 'python', 'sudo apt install python3'],
  ffmpeg: ['ffmpeg', '-version', 'Gyan.FFmpeg', 'ffmpeg', 'sudo apt install ffmpeg'],
};

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const works = (cmd, args) => run(cmd, args, { stdio: 'ignore' }).status === 0;
const hasTool = (name) =>
  works(TOOLS[name][0], [TOOLS[name][1]]) || (name === 'python' && works('python3', ['--version']));

function fixFor(name) {
  const [, , wingetId, brewName, other] = TOOLS[name];
  if (process.platform === 'win32') return `winget install --id ${wingetId} -e`;
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

const loadManifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const coreNames = (manifest) => manifest.sources.flatMap((s) => Object.keys(s.skills || {}));
const havePacks = (dir, names) => names.filter((n) => fs.existsSync(path.join(dir, n, 'PACK.md')));
// Claude installed Graut as a plugin and already has it; a second copy would list it twice.
const isPlugin = () => SKILL_DIR.startsWith(path.join(CLAUDE, 'plugins') + path.sep);

function git(dir, ...args) {
  const r = run('git', ['-C', dir, ...args]);
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || String(r.error)).trim()}`);
  return r.stdout.trim();
}

// Sparse, shallow download of exactly the pinned commit.
function fetchSource(source, paths) {
  const dir = path.join(VENDOR, source.id);
  const url = /^[\w.-]+\/[\w.-]+$/.test(source.repo) ? `https://github.com/${source.repo}.git` : source.repo;
  try {
    if (!fs.existsSync(path.join(dir, '.git'))) {
      fs.mkdirSync(dir, { recursive: true });
      git(dir, 'init', '-q');
      git(dir, 'remote', 'add', 'origin', url);
      git(dir, 'config', 'core.autocrlf', 'false');
      git(dir, 'config', 'core.symlinks', 'false');
      git(dir, 'config', 'core.longpaths', 'true');
    }
    git(dir, 'remote', 'set-url', 'origin', url);
    git(dir, 'sparse-checkout', 'set', '--no-cone', '/LICENSE*', '/NOTICE*', ...paths.map((p) => `/${p}`));
    const head = run('git', ['-C', dir, 'rev-parse', '--verify', '-q', 'HEAD']).stdout.trim();
    if (head !== source.sha) {
      git(dir, 'fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', source.sha);
      git(dir, 'checkout', '-q', '--force', '--detach', source.sha);
    }
    const missing = paths.filter((p) => !fs.existsSync(path.join(dir, p)));
    if (missing.length) throw new Error(`not found upstream: ${missing.join(', ')}`);
    return dir;
  } catch (error) {
    // A half-made download is removed; an earlier good one (with a commit) is kept.
    if (!works('git', ['-C', dir, 'rev-parse', '--verify', '-q', 'HEAD'])) fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

const noLinks = (file) => !fs.lstatSync(file).isSymbolicLink();

// Builds one skill folder from a downloaded source.
function stageSkill(source, repoDir, name, from) {
  const stage = path.join(STAGE, source.id, name);
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  for (const item of [].concat(from)) {
    const to = Array.isArray(from) ? path.join(stage, path.basename(item)) : stage;
    fs.cpSync(path.join(repoDir, item), to, { recursive: true, filter: noLinks });
  }
  for (const file of fs.readdirSync(repoDir)) {
    if (/^(LICENSE|NOTICE)/i.test(file)) fs.cpSync(path.join(repoDir, file), path.join(stage, `UPSTREAM-${file}`));
  }
  return stage;
}

// Never overwrites a folder Graut did not install: those carry no .graut marker.
const isUsers = (dest) => fs.existsSync(dest) && !fs.existsSync(path.join(dest, '.graut'));

function place(from, dest, tag) {
  if (path.resolve(from) === path.resolve(dest) || isUsers(dest)) return 'kept';
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(from, dest, { recursive: true, filter: noLinks });
  fs.writeFileSync(path.join(dest, '.graut'), `${tag}\n`);
  return 'installed';
}

// Graut 1.0 installed every specialist as its own skill. Those copies now live inside Graut.
function removeSeparateCopies(skillsDir, names) {
  return names.filter((name) => {
    const marker = path.join(skillsDir, name, '.graut');
    if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim() !== TAG) return false;
    fs.rmSync(path.join(skillsDir, name), { recursive: true, force: true });
    return true;
  }).length;
}

function findScanner() {
  if (works('skillspector', ['--help'])) return 'skillspector';
  const r = run('uv', ['tool', 'dir', '--bin']);
  if (r.status !== 0) return null;
  const bin = path.join(r.stdout.trim(), process.platform === 'win32' ? 'skillspector.exe' : 'skillspector');
  return fs.existsSync(bin) ? bin : null;
}

function ensureScanner(manifest) {
  const found = findScanner();
  if (found || !hasTool('uv')) return found;
  const source = manifest.sources.find((s) => s.id === manifest.scanner);
  if (!source) return null;
  console.log('\nInstalling SkillSpector (security scanner) ...');
  run('uv', ['tool', 'install', '--python', '3.13', `git+https://github.com/${source.repo}.git@${source.sha}`], {
    stdio: 'inherit',
  });
  return findScanner();
}

// SkillSpector exit codes: 0 safe or caution, 1 high risk, anything else means the scan did not happen.
function scan(scanner, dir) {
  if (!scanner) return Promise.resolve('unscanned');
  return new Promise((resolve) => {
    const child = spawn(scanner, ['scan', dir, '--no-llm'], {
      stdio: 'ignore',
      timeout: 600000,
      env: { ...process.env, PYTHONUTF8: '1' },
    });
    child.on('error', () => resolve('unscanned'));
    child.on('close', (status) => resolve({ 0: 'safe', 1: 'risky' }[status] || 'unscanned'));
  });
}

// The scanner looks for SKILL.md, so each pack is scanned as a temporary copy under that name.
// Several run at once because each one is slow.
async function scanPacks(scanner, names) {
  const verdicts = new Map();
  const queue = [...names];
  console.log(`\nScanning ${names.length} skills. This takes several minutes.`);
  const worker = async () => {
    while (queue.length) {
      const name = queue.shift();
      const copy = path.join(STAGE, 'scan', name);
      fs.cpSync(path.join(PACKS, name), copy, { recursive: true, filter: noLinks });
      fs.renameSync(path.join(copy, 'PACK.md'), path.join(copy, 'SKILL.md'));
      verdicts.set(name, await scan(scanner, copy));
      console.log(`  [${verdicts.size}/${names.length}] ${name}: ${verdicts.get(name)}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, os.cpus().length) }, worker));
  fs.rmSync(STAGE, { recursive: true, force: true });
  return verdicts;
}

function pickAgents(list) {
  if (list) {
    const names = list.split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = names.filter((n) => !AGENTS[n]);
    if (unknown.length || !names.length) {
      throw new Error(`unknown agent "${unknown.join(', ')}". Choose from: ${Object.keys(AGENTS).join(', ')}`);
    }
    return names;
  }
  const found = Object.keys(AGENTS).filter((n) => AGENTS[n].detect.some((p) => fs.existsSync(p)));
  return found.length ? found : ['codex']; // ~/.agents/skills is the shared fallback
}

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const isActive = (file) => BLOCK_RE.test(read(file));

function deactivate(file) {
  if (isActive(file)) fs.writeFileSync(file, read(file).replace(BLOCK_RE, ''));
}

function activate(file, level) {
  const text = block(level);
  if (!text) return deactivate(file);
  const old = read(file);
  if (old && !BLOCK_RE.test(old)) fs.copyFileSync(file, `${file}.graut.bak`);
  const next = BLOCK_RE.test(old)
    ? old.replace(BLOCK_RE, () => `${text}\n`)
    : `${old}${old && !old.endsWith('\n') ? '\n' : ''}${text}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
}

// `graut level` shows the level; `graut level ultra` changes it for every agent.
function level(name, opts) {
  const before = savedLevel();
  if (!name) {
    console.log(`Graut level: ${before} (choose from ${LEVELS.join(', ')})`);
    return 0;
  }
  if (!LEVELS.includes(name)) throw new Error(`unknown level "${name}". Choose from: ${LEVELS.join(', ')}`);
  fs.mkdirSync(path.dirname(LEVEL_FILE), { recursive: true });
  fs.writeFileSync(LEVEL_FILE, `${name}\n`);
  for (const agent of pickAgents(opts.agents)) {
    const { memory } = AGENTS[agent];
    // Files without the note are left alone, unless "off" is what removed it.
    if (memory && (isActive(memory) || (before === 'off' && !opts['no-activate']))) {
      activate(memory, name);
      console.log(`${agent}: ${memory} updated`);
    }
  }
  console.log(`Graut level: ${name}\n\n${SAY.done}`);
  return 0;
}

async function install(opts) {
  console.log(`\n${SAY.start}\n`);
  const autoInstall = !opts['no-system-deps'];
  const todo = Object.keys(TOOLS).filter((t) => !ensureTool(t, autoInstall)).map(fixFor);
  if (Number(process.versions.node.split('.')[0]) < 22) todo.push('upgrade Node.js to 22+ for the video skills');

  const manifest = loadManifest();
  const names = coreNames(manifest);
  const agents = pickAgents(opts.agents);
  console.log(`Agents: ${agents.join(', ')}`);
  const scanner = autoInstall ? ensureScanner(manifest) : findScanner();

  const bundled = havePacks(PACKS, names);
  if (bundled.length < names.length) {
    todo.push(`${names.length - bundled.length} skills are missing from this copy; run: ${CMD}`);
  }

  let verdicts = new Map();
  if (opts.scan || opts.strict) {
    if (scanner) verdicts = await scanPacks(scanner, bundled);
    else todo.push('get SkillSpector running (needs uv), then run install again');
  }
  const flagged = bundled.filter((n) => verdicts.get(n) === 'risky');
  const blocked = opts.strict ? bundled.filter((n) => verdicts.get(n) !== 'safe') : [];

  const failed = [];
  let merged = 0;
  for (const agent of agents) {
    const { skills, memory } = AGENTS[agent];
    const dest = path.join(skills, 'graut');
    try {
      merged += removeSeparateCopies(skills, names);
      if (agent === 'claude' && isPlugin()) {
        console.log('claude: Graut is already installed as a plugin');
      } else if (isUsers(dest)) {
        console.log(`${agent}: kept your own "graut" folder at ${dest}`);
      } else {
        place(SKILL_DIR, dest, TAG);
        for (const name of blocked) fs.rmSync(path.join(dest, 'packs', name), { recursive: true, force: true });
        console.log(`${agent}: graut installed with ${havePacks(path.join(dest, 'packs'), names).length} skills inside`);
      }
      if (memory && !opts['no-activate']) activate(memory, savedLevel());
    } catch (error) {
      failed.push(`${agent}: ${error.message}`);
    }
  }

  if (merged) console.log(`\nMerged ${merged} separate skills from an older version into Graut.`);
  if (flagged.length) console.log(`\nSkillSpector rated these high risk: ${flagged.join(', ')} (see SCAN.md)`);
  if (blocked.length) console.log(`Left out because they did not pass the scan (--strict): ${blocked.join(', ')}`);
  for (const line of failed) console.log(`Failed: ${line}`);
  if (failed.length) todo.push('fix the failures above and run install again');
  console.log(`\n${todo.length ? SAY.need(todo.join(' ; ')) : SAY.done}`);
  console.log('Restart your agent to load Graut.');
  return failed.length ? 1 : 0;
}

function uninstall(opts) {
  const agents = opts.agents ? pickAgents(opts.agents) : Object.keys(AGENTS);
  let removed = 0;
  for (const agent of agents) {
    const { skills, memory } = AGENTS[agent];
    for (const name of fs.existsSync(skills) ? fs.readdirSync(skills) : []) {
      if (fs.existsSync(path.join(skills, name, '.graut'))) {
        fs.rmSync(path.join(skills, name), { recursive: true, force: true });
        removed++;
      }
    }
    if (memory) deactivate(memory);
  }
  if (!opts.agents) fs.rmSync(at('.graut'), { recursive: true, force: true });
  console.log(`Removed ${removed} folders Graut installed. Your own skills were not touched.`);
  console.log('SkillSpector stays; remove it with: uv tool uninstall skillspector');
  return 0;
}

function doctor(opts) {
  const missing = Object.keys(TOOLS).filter((t) => !hasTool(t));
  for (const tool of Object.keys(TOOLS)) console.log(`${missing.includes(tool) ? 'MISSING' : 'ok     '} ${tool}`);
  console.log(`${findScanner() ? 'ok     ' : 'MISSING'} skillspector`);
  const names = coreNames(loadManifest());
  let absent = 0;
  for (const agent of pickAgents(opts.agents)) {
    const dir = agent === 'claude' && isPlugin() ? SKILL_DIR : path.join(AGENTS[agent].skills, 'graut');
    const found = fs.existsSync(path.join(dir, 'SKILL.md')) ? havePacks(path.join(dir, 'packs'), names).length : 0;
    absent += names.length - found;
    console.log(`${agent}: ${found}/${names.length} skills inside graut`);
  }
  const todo = missing.map(fixFor);
  if (absent || !findScanner()) todo.push(`run: ${CMD}`);
  console.log(`\n${todo.length ? SAY.need(todo.join(' ; ')) : SAY.done}`);
  return todo.length ? 1 : 0;
}

// Claude Code runs this when a session starts. Silent if CLAUDE.md already says the same.
function hook() {
  const text = block(savedLevel());
  if (text && !read(AGENTS.claude.memory).includes(text)) console.log(text);
  return 0;
}

// Skill and catalog text is untrusted: strip terminal control characters before printing.
const clean = (text) => String(text || '').replace(/[\x00-\x1f\x7f-\x9f]+/g, ' ').trim().slice(0, 160);

function readLibrary(id, file) {
  const full = path.join(SKILL_DIR, 'library', id, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

// Every skill already on this machine: Graut's packs, added ones, all agents and this project.
function localSkills() {
  const project = ['.claude', '.agents', '.agent'].map((d) => path.resolve(d, 'skills'));
  const dirs = [PACKS, ADDED, ...project, ...Object.values(AGENTS).map((a) => a.skills)];
  const found = new Map();
  for (const dir of dirs) {
    for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const file = path.join(dir, name, dir === PACKS ? 'PACK.md' : 'SKILL.md');
      if (name === 'graut' || !fs.existsSync(file)) continue;
      const head = fs.readFileSync(file, 'utf8').split(/^---\s*$/m)[1] || '';
      // description may continue on indented lines
      const text = /^description:[ \t]*[>|]?-?(.*(?:\r?\n[ \t]+.*)*)/m.exec(head);
      const description = text ? text[1].replace(/\s+/g, ' ').trim() : '';
      // copies of one skill are listed once; a different skill with the same name is not hidden
      const key = `${name} ${description}`;
      if (!found.has(key)) found.set(key, { name, file, description });
    }
  }
  return [...found.values()];
}

function rank(items, terms, limit) {
  return items
    .map((item) => {
      const title = `${item.id || ''} ${item.name}`.toLowerCase();
      const body = `${item.category || ''} ${item.description}`.toLowerCase();
      // matching more of the words outranks matching one word in the title
      const points = (t) => (title.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0);
      return { item, score: terms.reduce((n, t) => n + (points(t) ? 10 + points(t) : 0), 0) };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => h.item);
}

function find(words) {
  const terms = words.join(' ').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    console.log(SAY.need(`say what you need: ${CMD} find "pdf tables"`));
    return 1;
  }
  const local = rank(localSkills(), terms, 8);
  if (local.length) console.log('Already on this machine (read the file and use it):');
  for (const s of local) console.log(`${clean(s.name)}  ${s.file}\n    ${clean(s.description)}`);

  const { catalog } = loadManifest();
  const remote = rank(JSON.parse(readLibrary(catalog, 'skills_index.json') || '[]'), terms, 10);
  if (remote.length) console.log('\nIn the catalog (not downloaded yet):');
  for (const s of remote) console.log(`${clean(s.id)}  [risk: ${clean(s.risk)}]\n    ${clean(s.description)}`);
  if (remote.length) console.log(`\nAdd one with: ${CMD} add <id>`);

  const links = (readLibrary('awesome-agent-skills', 'README.md') || '')
    .split('\n')
    .filter((l) => l.startsWith('- **[') && terms.every((t) => l.toLowerCase().includes(t)))
    .slice(0, 5);
  if (links.length) console.log(`\nAlso listed by VoltAgent (read before installing):\n${links.map(clean).join('\n')}`);
  if (!local.length && !remote.length && !links.length) console.log('Nothing found. Try other words.');
  return 0;
}

async function add(id, opts) {
  const manifest = loadManifest();
  const source = manifest.sources.find((s) => s.id === manifest.catalog);
  const entry = JSON.parse(readLibrary(source.id, 'skills_index.json') || '[]').find((s) => s.id === id);
  if (!entry) throw new Error(`no catalog skill with id "${id}". Search with: ${CMD} find <words>`);
  // The catalog is third-party data, so its path is validated before it reaches git or the file system.
  if (!/^skills(\/[A-Za-z0-9_][A-Za-z0-9._-]*)+$/.test(entry.path)) throw new Error('unsafe path in catalog entry');
  const name = path.posix.basename(entry.path);
  if (name === 'graut' || coreNames(manifest).includes(name)) {
    throw new Error(`"${name}" is already inside Graut and is not replaced from the catalog`);
  }
  if (!ensureTool('git', false)) throw new Error(fixFor('git'));
  const scanner = ensureScanner(manifest);
  const stage = stageSkill(source, fetchSource(source, [entry.path]), name, entry.path);
  try {
    const verdict = await scan(scanner, stage);
    if (verdict !== 'safe' && !opts['allow-risky']) {
      const why = verdict === 'risky' ? 'SkillSpector rated it high risk' : 'it could not be scanned';
      console.log(SAY.need(`${why}. Read it, and only if you trust it run: ${CMD} add ${id} --allow-risky`));
      return 1;
    }
    const dest = path.join(ADDED, name);
    place(stage, dest, `${source.repo}@${source.sha}`);
    console.log(`Added. Graut uses it from: ${path.join(dest, 'SKILL.md')}\n\n${SAY.done}`);
    return 0;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

const HELP = `${SAY.help}

Run as: ${CMD} [command]

  install (default)    put the graut skill into your agents and turn it on
  doctor               show what is installed and what is missing
  find <words>         search skills on this machine and in the catalogs
  add <id>             scan one catalog skill and give it to Graut
  level [name]         show or set how hard Graut works: ${LEVELS.join(', ')}
  uninstall            remove everything Graut installed

Options
  --agents a,b         ${Object.keys(AGENTS).join(', ')} (default: every agent found)
  --no-activate        do not edit CLAUDE.md / AGENTS.md / GEMINI.md
  --no-system-deps     do not install git, uv, python, ffmpeg or SkillSpector
  --scan               scan the bundled skills with SkillSpector before installing
  --strict             scan, and install only the skills that pass
  --allow-risky        with add: add it even if the scan fails or is missing`;

function main(argv) {
  const flag = { type: 'boolean' };
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      agents: { type: 'string' },
      'no-activate': flag,
      'no-system-deps': flag,
      scan: flag,
      strict: flag,
      'allow-risky': flag,
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command = 'install', ...rest] = positionals;
  if (values.help || command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (command === 'install') return install(values);
  if (command === 'uninstall') return uninstall(values);
  if (command === 'doctor') return doctor(values);
  if (command === 'hook') return hook();
  if (command === 'level') return level(rest[0], values);
  if (command === 'find') return find(rest);
  if (command === 'add' && rest[0]) return add(rest[0], values);
  console.log(HELP);
  return 1;
}

if (require.main === module) {
  (async () => {
    try {
      process.exitCode = await main(process.argv.slice(2));
    } catch (error) {
      console.error(SAY.need(error.message));
      process.exitCode = 1;
    }
  })();
} else {
  module.exports = { fetchSource, stageSkill, loadManifest };
}
