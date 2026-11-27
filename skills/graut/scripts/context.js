'use strict';
// Code context for a task from CodeGraph (https://github.com/colbymchenry/codegraph, MIT):
// the relevant symbols, their current source and who calls them, in one call instead of many reads.
// CodeGraph is a separate program that Graut's installer installs; this file only calls it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Pinned, like the specialists: a new version is taken on purpose.
const PACKAGE = '@colbymchenry/codegraph@1.6.4';
const INSTALL = `npm install -g ${PACKAGE}`;
const MAX_CHARS = 14000;
const SOURCE = /\.(py|[cm]?[jt]sx?|go|rs|rb|java|kt|php|swift|cs|c|cc|cpp|h|hpp|m|vue|svelte|dart|scala|lua)$/i;
const SKIP = /^(\.|node_modules$|vendor$|dist$|build$|target$|venv$|__pycache__$)/;

// Runs CodeGraph in the project, with its usage reporting and update check off.
function codegraph(args, cwd, timeout) {
  const env = { ...process.env, DO_NOT_TRACK: '1', CODEGRAPH_TELEMETRY: '0', CODEGRAPH_NO_UPDATE_CHECK: '1' };
  delete env.CODEGRAPH_NO_WATCH; // with it, `init --yes` would add git hooks to the project
  const options = { cwd, env, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 };
  if (process.platform !== 'win32') return spawnSync('codegraph', args, options);
  // Windows looks in the current folder first: a project must not be able to supply its own program.
  env.NoDefaultCurrentDirectoryInExePath = '1';
  const cmd = process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
  return spawnSync(cmd, ['/d', '/c', 'codegraph', ...args], options);
}

const installed = () => codegraph(['--version'], os.tmpdir(), 60000).status === 0;

// The words reach a command line, so only characters that mean nothing to a shell are kept.
const words = (text) => text.replace(/[^\p{L}\p{N}_./ -]+/gu, ' ').split(/\s+/).filter((w) => w && !w.startsWith('-'));

const indexed = (dir) => fs.existsSync(path.join(dir, '.codegraph', 'codegraph.db'));

// The nearest folder at or above this one that has an index, below the home folder.
function indexedRoot(start, home) {
  for (let dir = path.resolve(start); dir !== path.resolve(home) && dir !== path.dirname(dir); dir = path.dirname(dir)) {
    if (indexed(dir)) return dir;
  }
  return null;
}

// The nearest folder above with an index, else the git top level, else this folder.
function projectRoot(start, home) {
  const found = indexedRoot(start, home);
  if (found) return found;
  const git = spawnSync('git', ['-C', start, 'rev-parse', '--show-toplevel'], { cwd: os.tmpdir(), encoding: 'utf8' });
  return git.status === 0 ? path.resolve(git.stdout.trim()) : start;
}

function hasSource(dir, depth = 0, seen = { count: 0 }) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some((entry) => {
    if (++seen.count > 5000) return false;
    if (entry.isFile()) return SOURCE.test(entry.name);
    return entry.isDirectory() && depth < 5 && !SKIP.test(entry.name) && hasSource(path.join(dir, entry.name), depth + 1, seen);
  });
}

// Prints the context, or one line saying why there is none. Never fails the task that asked.
function context(task, { home = os.homedir(), cwd = process.cwd() } = {}) {
  const say = (line) => {
    console.log(line);
    return 0;
  };
  const without = (why) => say(`No code context: ${why}. Search and read the files you need instead.`);
  const query = words(task);
  if (!query.length) return without('name the symbols, files or behaviour the task is about');
  const start = path.resolve(cwd);
  const root = projectRoot(start, path.resolve(home));
  if (root === path.resolve(home) || root === path.parse(root).root) return without('this is a home folder or a drive, not a project');
  if (!indexed(root) && !hasSource(root)) return without('there is no source code here');
  if (!installed()) return without(`CodeGraph is not installed (the user can run: ${INSTALL})`);

  if (!indexed(root)) {
    // CodeGraph adds git hooks where it cannot watch files, which is the case here: leave that to the user.
    if (process.env.WSL_DISTRO_NAME && root.startsWith('/mnt/')) return without('this Windows folder needs `codegraph init` run by the user');
    console.log(`Indexing this project once (a .codegraph folder, kept out of git) ...`);
    if (codegraph(['init', '--local-only', '--yes'], root, 600000).status !== 0 || !indexed(root)) {
      return without('indexing did not finish');
    }
  } else {
    codegraph(['sync'], root, 180000); // pick up edits; an old index is still useful if this fails
  }
  const found = codegraph(['explore', '--max-files', '3', '--', ...query], root, 180000);
  const text = (found.stdout || '').trim();
  if (found.status !== 0 || !text) return without('CodeGraph found nothing for these words');
  return say(text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n(cut here; ask again with narrower words)` : text);
}

module.exports = { context, installed, indexedRoot, PACKAGE, INSTALL };
