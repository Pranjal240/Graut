#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs } = require('util');
const { run, works, shell, npm, ensureTool, fixFor, TOOLS, prepare, report } = require('./setup.js');

const SKILL_DIR = path.dirname(__dirname);
// The npm package or clone this script runs from; it also holds the Claude Code plugin.
const PACKAGE = path.join(SKILL_DIR, '..', '..');
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
const PLUGIN = at('.graut', 'plugin'); // the copy Claude Code loads the plugin from
const CREATED = at('.graut', 'created.txt'); // files made outside Graut's folders, removed on uninstall
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
    if (!works('git', ['-C', dir, 'rev-parse', '--verify', '-q', 'HEAD'])) remove(dir);
    throw error;
  }
}

// Windows can refuse for a moment to delete a large folder, so removal is retried.
const remove = (target) => fs.rmSync(target, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
const noLinks = (file) => !fs.lstatSync(file).isSymbolicLink();

// Builds one skill folder from a downloaded source.
function stageSkill(source, repoDir, name, from) {
  const stage = path.join(STAGE, source.id, name);
  remove(stage);
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

// A package published from Windows loses the "runnable" flag, which macOS and Linux need
// to start a script directly. Every file that begins with #! gets it back.
function makeRunnable(dir) {
  if (process.platform === 'win32' || !fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') makeRunnable(file);
    } else if (entry.isFile()) {
      const start = Buffer.alloc(2);
      const handle = fs.openSync(file, 'r');
      fs.readSync(handle, start, 0, 2, 0);
      fs.closeSync(handle);
      if (start.toString() === '#!') fs.chmodSync(file, 0o755);
    }
  }
}

// Never overwrites a folder Graut did not install: those carry no .graut marker.
const isUsers = (dest) => fs.existsSync(dest) && !fs.existsSync(path.join(dest, '.graut'));

function place(from, dest, tag) {
  if (path.resolve(from) === path.resolve(dest) || isUsers(dest)) return 'kept';
  remove(dest);
  fs.cpSync(from, dest, { recursive: true, filter: noLinks });
  fs.writeFileSync(path.join(dest, '.graut'), `${tag}\n`);
  return 'installed';
}

// Removes folders an earlier Graut install made, never the user's own.
function removeOurs(skillsDir, names) {
  return names.filter((name) => {
    const marker = path.join(skillsDir, name, '.graut');
    if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim() !== TAG) return false;
    remove(path.join(skillsDir, name));
    return true;
  }).length;
}

// Claude Code's own command, pointed at the sandbox during tests.
const claude = (...args) =>
  shell('claude', args, {
    env: process.env.GRAUT_HOME ? { ...process.env, CLAUDE_CONFIG_DIR: CLAUDE } : process.env,
    timeout: 300000,
  });

// Installs Graut as a Claude Code plugin: the panel, the direct /graut:<skill> commands and the skill.
function installPlugin() {
  if (!fs.existsSync(path.join(PACKAGE, '.claude-plugin', 'plugin.json'))) return false;
  if (claude('--version').status !== 0) return false;
  if (path.resolve(PACKAGE) !== path.resolve(PLUGIN)) {
    remove(PLUGIN);
    for (const part of ['.claude-plugin', 'assets', 'commands', 'hooks', 'skills', 'types']) {
      const from = path.join(PACKAGE, part);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(PLUGIN, part), { recursive: true, filter: noLinks });
    }
  }
  claude('plugin', 'marketplace', 'remove', 'graut'); // an older source of the same name would win
  if (claude('plugin', 'marketplace', 'add', PLUGIN).status !== 0) return false;
  claude('plugin', 'install', 'graut@graut');
  return /graut@graut/.test(claude('plugin', 'list').stdout || '');
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

function findScanner() {
  if (works('skillspector', ['--help'])) return 'skillspector';
  const r = run('uv', ['tool', 'dir', '--bin']);
  if (r.status !== 0) return null;
  const bin = path.join(r.stdout.trim(), process.platform === 'win32' ? 'skillspector.exe' : 'skillspector');
  return fs.existsSync(bin) ? bin : null;
}

function ensureScanner(manifest) {
  const found = findScanner();
  if (found || !works('uv', ['--version'])) return found;
  const source = manifest.sources.find((s) => s.id === manifest.scanner);
  if (!source) return null;
  console.log('\nInstalling SkillSpector (security scanner) ...');
  run('uv', ['tool', 'install', '--python', '3.13', `git+https://github.com/${source.repo}.git@${source.sha}`], {
    stdio: 'inherit',
  });
  return findScanner();
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
  const bundled = havePacks(PACKS, names);
  if (bundled.length < names.length) {
    todo.push(`${names.length - bundled.length} skills are missing from this copy; run: ${CMD}`);
  }

  const failed = [];
  const packsFolders = [];
  let merged = 0;
  let plugin = false;
  for (const agent of agents) {
    const { skills, memory } = AGENTS[agent];
    const dest = path.join(skills, 'graut');
    try {
      merged += removeOurs(skills, names);
      if (agent === 'claude' && isPlugin()) {
        console.log('claude: Graut is already installed as a plugin');
        packsFolders.push(PACKS);
      } else if (agent === 'claude' && !opts['no-plugin'] && installPlugin()) {
        plugin = true;
        removeOurs(skills, ['graut']); // the plugin brings the skill; a second copy would list it twice
        console.log(`claude: Graut plugin installed with the panel and ${bundled.length} skills`);
        packsFolders.push(path.join(PLUGIN, 'skills', 'graut', 'packs'));
      } else if (isUsers(dest)) {
        console.log(`${agent}: kept your own "graut" folder at ${dest}`);
      } else {
        place(SKILL_DIR, dest, TAG);
        packsFolders.push(path.join(dest, 'packs'));
        console.log(`${agent}: graut installed with ${havePacks(path.join(dest, 'packs'), names).length} skills inside`);
        if (agent === 'claude' && !opts['no-plugin']) {
          todo.push('for the panel, in Claude Code run: /plugin marketplace add Pranjal240/Graut then /plugin install graut@graut');
        }
      }
      if (memory && !opts['no-activate']) activate(memory, savedLevel());
    } catch (error) {
      failed.push(`${agent}: ${error.message}`);
    }
  }
  if (merged) console.log(`\nMerged ${merged} separate skills from an older version into Graut.`);
  packsFolders.forEach(makeRunnable);

  if (autoInstall) {
    const remember = (file) => {
      fs.mkdirSync(path.dirname(CREATED), { recursive: true });
      fs.appendFileSync(CREATED, `${file}\n`);
    };
    todo.push(...prepare(packsFolders, remember));
    ensureScanner(manifest);
  }

  for (const line of failed) console.log(`Failed: ${line}`);
  if (failed.length) todo.push('fix the failures above and run install again');
  if (plugin && /ponytail@/.test(claude('plugin', 'list').stdout || '')) {
    console.log('\nGraut already includes ponytail. To see only the Graut panel: claude plugin disable ponytail@ponytail');
  }
  console.log(`\n${todo.length ? SAY.need(todo.join(' ; ')) : SAY.done}`);
  console.log('Restart your agent to load Graut.');
  if (plugin) console.log('In Claude Code: /graut:graut for anything, or one skill directly, such as /graut:impeccable.');
  return failed.length ? 1 : 0;
}

// Fetches the newest release from npm and installs it over this one, with the same options.
function upgrade(opts) {
  if (opts.agents) pickAgents(opts.agents); // refuses unknown names before they reach a command line
  const away = { cwd: os.tmpdir(), timeout: 600000 }; // inside a Graut clone, npx would run the clone
  const latest = npm('npm', ['view', 'graut-bhar-de', 'version', '--prefer-online'], away).stdout?.trim();
  if (!/^\d+\.\d+\.\d+$/.test(latest || '')) throw new Error(`check your connection, then run: ${CMD} upgrade`);
  console.log(`Newest Graut on npm: ${latest}`);
  const target = `graut-bhar-de@${latest}`;
  const show = { ...away, stdio: 'inherit' };
  // a global install would otherwise keep `npx graut` on the old version
  const stale =
    npm('npm', ['ls', '-g', 'graut-bhar-de', '--depth=0'], away).status === 0 &&
    npm('npm', ['install', '-g', target], show).status !== 0;
  const flags = Object.entries(opts).flatMap(([key, value]) => (value === true ? [`--${key}`] : [`--${key}`, value]));
  const { status } = npm('npx', ['--yes', target, 'install', ...flags], { ...show, timeout: undefined });
  const admin = process.platform === 'win32' ? '' : 'sudo ';
  if (stale) console.log(`\n${SAY.need(`${admin}npm install -g ${target}`)}`);
  return status === 0 && !stale ? 0 : 1;
}

function uninstall(opts) {
  const agents = opts.agents ? pickAgents(opts.agents) : Object.keys(AGENTS);
  let removed = 0;
  for (const agent of agents) {
    const { skills, memory } = AGENTS[agent];
    for (const name of fs.existsSync(skills) ? fs.readdirSync(skills) : []) {
      if (fs.existsSync(path.join(skills, name, '.graut'))) {
        remove(path.join(skills, name));
        removed++;
      }
    }
    if (memory) deactivate(memory);
  }
  if (agents.includes('claude') && fs.existsSync(PLUGIN)) {
    claude('plugin', 'uninstall', 'graut@graut');
    claude('plugin', 'marketplace', 'remove', 'graut');
    remove(PLUGIN);
    console.log('Removed the Claude Code plugin.');
  }
  if (!opts.agents) {
    for (const file of read(CREATED).split('\n').filter((f) => path.basename(f) === 'python3.exe')) {
      remove(file);
    }
    remove(at('.graut'));
  }
  console.log(`Removed ${removed} folders Graut installed. Your own skills were not touched.`);
  console.log('Tools and Python packages stay, because other programs may use them.');
  return 0;
}

function doctor(opts) {
  const names = coreNames(loadManifest());
  const packsFolders = [];
  const skillLines = [];
  let absent = 0;
  for (const agent of pickAgents(opts.agents)) {
    const asPlugin = agent === 'claude' && (isPlugin() || fs.existsSync(PLUGIN));
    const dir = asPlugin ? (isPlugin() ? SKILL_DIR : path.join(PLUGIN, 'skills', 'graut')) : path.join(AGENTS[agent].skills, 'graut');
    const found = fs.existsSync(path.join(dir, 'SKILL.md')) ? havePacks(path.join(dir, 'packs'), names).length : 0;
    absent += names.length - found;
    if (found) packsFolders.push(path.join(dir, 'packs'));
    skillLines.push(`${agent}: ${found}/${names.length} skills inside graut${asPlugin ? ' (plugin, with the panel)' : ''}`);
  }
  const todo = report(packsFolders);
  console.log(`\n${skillLines.join('\n')}`);
  if (absent) todo.push(`run: ${CMD}`);
  console.log(`\n${todo.length ? SAY.need([...new Set(todo)].join(' ; ')) : SAY.done}`);
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

// SkillSpector exit codes: 0 safe or caution, 1 high risk, anything else means the scan did not happen.
function scan(scanner, dir) {
  if (!scanner) return 'unscanned';
  const { status } = run(scanner, ['scan', dir, '--no-llm'], {
    stdio: 'ignore',
    timeout: 600000,
    env: { ...process.env, PYTHONUTF8: '1' },
  });
  return { 0: 'safe', 1: 'risky' }[status] || 'unscanned';
}

// A catalog skill comes from a stranger and was never part of Graut, so it is scanned first.
function add(id, opts) {
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
    const verdict = scan(scanner, stage);
    if (verdict !== 'safe' && !opts['allow-risky']) {
      const why = verdict === 'risky' ? 'SkillSpector did not pass it' : 'it could not be scanned';
      console.log(SAY.need(`${why}. Read it, and only if you trust it run: ${CMD} add ${id} --allow-risky`));
      return 1;
    }
    const dest = path.join(ADDED, name);
    place(stage, dest, `${source.repo}@${source.sha}`);
    console.log(`Added. Graut uses it from: ${path.join(dest, 'SKILL.md')}\n\n${SAY.done}`);
    return 0;
  } finally {
    remove(stage);
  }
}

const HELP = `${SAY.help}

Run as: ${CMD} [command]

  install (default)    install Graut, its panel and what the skills need
  upgrade              get the newest version and install it
  doctor               show what is installed and what is missing
  find <words>         search skills on this machine and in the catalogs
  add <id>             scan one catalog skill and give it to Graut
  level [name]         show or set how hard Graut works: ${LEVELS.join(', ')}
  uninstall            remove everything Graut installed

Options
  --agents a,b         ${Object.keys(AGENTS).join(', ')} (default: every agent found)
  --no-activate        do not edit CLAUDE.md / AGENTS.md / GEMINI.md
  --no-plugin          Claude Code: copy the skill only, without the plugin and panel
  --no-system-deps     do not install tools, packages or anything else the skills need
  --allow-risky        with add: add it even if the scan fails or is missing`;

function main(argv) {
  const flag = { type: 'boolean' };
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      agents: { type: 'string' },
      'no-activate': flag,
      'no-plugin': flag,
      'no-system-deps': flag,
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
  if (command === 'upgrade') return upgrade(values);
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
