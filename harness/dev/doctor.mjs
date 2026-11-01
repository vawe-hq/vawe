#!/usr/bin/env node
// vawe doctor: check every outside tool a render needs and print the install line for each missing one.
// Exit 1 only when a required tool is missing. --json prints [{tool, required, ok, version, fix}].
// Advice lines for unregistered live hooks (harness/lib/hook-check.mjs) never change the exit code.
// --quiet prints problems only and writes .vawe/doctor.json (postinstall uses it; a failed render reads it).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CHROME_FIX } from '../lib/doctor-hint.mjs';
import { missingHooks, hookAdvice } from '../lib/hook-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const quiet = process.argv.includes('--quiet');
const asJson = process.argv.includes('--json');
const RESULT_FILE = path.join(ROOT, '.vawe', 'doctor.json');

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  return r.error || r.status !== 0 ? null : `${r.stdout}${r.stderr}`;
};
const firstLine = (text) => text.split('\n')[0].trim();
const found = (version) => ({ ok: true, version });
const lacks = (why) => ({ ok: false, why });

function probeBinary(cmd, flag = '-version') {
  const out = run(cmd, [flag]);
  return out ? found(firstLine(out)) : lacks(`${cmd} not on PATH`);
}

const BLACK_FRAME = ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=0.1', '-frames:v', '1'];

function probeFfmpeg() {
  const base = probeBinary('ffmpeg');
  if (!base.ok) return base;
  const encodes = run('ffmpeg', [...BLACK_FRAME, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'null', '-']) !== null;
  const draws = run('ffmpeg', [...BLACK_FRAME, '-vf', 'drawtext=text=x', '-f', 'null', '-']) !== null;
  const missing = [!encodes && 'libx264 encode', !draws && 'drawtext'].filter(Boolean);
  return missing.length ? lacks(`this ffmpeg build cannot run ${missing.join(' or ')}`) : base;
}

async function probeChrome() {
  let browser;
  try {
    const { default: puppeteer } = await import('puppeteer');
    if (!fs.existsSync(puppeteer.executablePath())) return lacks('puppeteer has no Chrome download');
    browser = await puppeteer.launch({ headless: true });
    await (await browser.newPage()).goto('about:blank');
    return found(await browser.version());
  } catch (e) { return lacks(`Chrome did not launch: ${String(e.message).split('\n')[0]}`); } finally { await browser?.close(); }
}

function probeNode() {
  const major = Number(process.versions.node.split('.')[0]);
  return major >= 22 ? found(process.version) : lacks(`found ${process.version}, need 22 or newer`);
}

const probeFile = (rel, dir = false) => () => {
  const p = path.join(ROOT, rel);
  const ok = dir ? fs.existsSync(p) && fs.readdirSync(p).length > 0 : fs.existsSync(p);
  return ok ? found(rel) : lacks(`${rel} is missing`);
};

// pkg: package name per manager key (see MANAGERS). fix: a plain command when no package manager applies.
const TOOLS = [
  { id: 'node', name: 'node 22+', required: true, probe: probeNode, pkg: { brew: 'node', apt: 'nodejs', dnf: 'nodejs', pacman: 'nodejs', apk: 'nodejs', zypper: 'nodejs22', winget: 'OpenJS.NodeJS.LTS', choco: 'nodejs-lts' } },
  { id: 'git', name: 'git', required: true, probe: () => probeBinary('git', '--version'), pkg: { brew: 'git', apt: 'git', dnf: 'git', pacman: 'git', apk: 'git', zypper: 'git', winget: 'Git.Git', choco: 'git' } },
  { id: 'ffmpeg', name: 'ffmpeg (libx264, drawtext)', required: true, probe: probeFfmpeg, pkg: { brew: 'ffmpeg', apt: 'ffmpeg', dnf: 'ffmpeg (needs the RPM Fusion repo)', pacman: 'ffmpeg', apk: 'ffmpeg', zypper: 'ffmpeg', winget: 'Gyan.FFmpeg', choco: 'ffmpeg' } },
  { id: 'ffprobe', name: 'ffprobe', required: true, probe: () => probeBinary('ffprobe'), pkg: { brew: 'ffmpeg', apt: 'ffmpeg', dnf: 'ffmpeg', pacman: 'ffmpeg', apk: 'ffmpeg', zypper: 'ffmpeg', winget: 'Gyan.FFmpeg', choco: 'ffmpeg' } },
  { id: 'tesseract', name: 'tesseract (optional, OCR for see --spec and check coverage --text)', required: false, probe: () => probeBinary('tesseract', '--version'), pkg: { brew: 'tesseract', apt: 'tesseract-ocr', dnf: 'tesseract', pacman: 'tesseract tesseract-data-eng', apk: 'tesseract-ocr', zypper: 'tesseract-ocr', winget: 'UB-Mannheim.TesseractOCR', choco: 'tesseract' } },
  { id: 'chrome', name: 'puppeteer Chrome', required: true, probe: probeChrome, fix: CHROME_FIX },
  { id: 'fonts', name: 'assets/fonts', required: true, probe: probeFile('assets/fonts', true), fix: 'git checkout -- assets/fonts, or node generators/media/fonts.mjs' },
];

// cmd is the install prefix. winget and choco take a package id, the others a package list.
const MANAGERS = {
  brew: { label: 'macOS (Homebrew)', cmd: 'brew install' },
  apt: { label: 'Debian or Ubuntu', cmd: 'sudo apt install -y' },
  dnf: { label: 'Fedora or RHEL', cmd: 'sudo dnf install -y' },
  pacman: { label: 'Arch', cmd: 'sudo pacman -S --needed' },
  apk: { label: 'Alpine', cmd: 'sudo apk add' },
  zypper: { label: 'openSUSE', cmd: 'sudo zypper install -y' },
  winget: { label: 'Windows (winget)', cmd: 'winget install -e --id' },
};
const LINUX_FAMILY = { debian: 'apt', ubuntu: 'apt', fedora: 'dnf', rhel: 'dnf', centos: 'dnf', arch: 'pacman', alpine: 'apk', suse: 'zypper', opensuse: 'zypper' };

function detectOs() {
  if (process.platform === 'darwin') return { label: 'macOS', manager: 'brew' };
  if (process.platform === 'win32') return { label: 'Windows', manager: 'winget' };
  let release = '';
  try { release = fs.readFileSync('/etc/os-release', 'utf8'); } catch { /* no os-release: unknown distro */ }
  const field = (key) => (release.match(new RegExp(`^${key}=("?)(.*)\\1$`, 'm')) || [])[2] || '';
  const ids = `${field('ID')} ${field('ID_LIKE')}`.toLowerCase().split(/\s+/);
  const family = ids.find((id) => LINUX_FAMILY[id]);
  return { label: field('ID') ? `Linux (${field('ID')})` : 'Linux', manager: family ? LINUX_FAMILY[family] : null };
}

function installLine(tool, os) {
  if (tool.fix) return tool.fix;
  if (!os.manager) return `install: ${Object.values(tool.pkg).filter((v, i, a) => a.indexOf(v) === i).join(' | ')} (package names vary by distro)`;
  return `${MANAGERS[os.manager].cmd} ${tool.pkg[os.manager]}`;
}

const os = detectOs();
const results = [];
for (const tool of TOOLS) results.push({ tool, ...(await tool.probe()) });

const report = results.map(({ tool, ok, version, why }) => ({ tool: tool.id, required: tool.required, ok, version: ok ? version : why, fix: ok ? null : installLine(tool, os) }));
const blocked = results.filter((r) => !r.ok && r.tool.required);

if (quiet) {
  fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
  fs.writeFileSync(RESULT_FILE, JSON.stringify(report, null, 1));
}
if (asJson) console.log(JSON.stringify(report, null, 1));
else {
  for (const { tool, ok, why } of results) {
    if (ok) continue;
    console.log(`${tool.required ? 'MISSING ' : 'optional'} ${tool.name}: ${why}`);
    console.log(`         fix: ${installLine(tool, os)}`);
  }
  if (!quiet && !blocked.length) console.log(`ok, ${results.length} checks (${os.label})`);
  for (const line of hookAdvice(missingHooks(ROOT))) console.log(line);
  if (blocked.length) console.log(`${blocked.length} required tool(s) missing.`);
}
process.exit(blocked.length ? 1 : 0);
