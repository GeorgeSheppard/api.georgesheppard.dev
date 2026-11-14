import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Builder, BuildResult, Files } from './types.js';

export async function writeFiles(dir: string, files: Files): Promise<void> {
  for (const [p, c] of Object.entries(files)) {
    const f = path.join(dir, p);
    if (!f.startsWith(dir + path.sep)) throw new Error('bad path');
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, c);
  }
}

export class MavenBuilder implements Builder {
  constructor(private options: { mavenCmd?: string; timeoutMs?: number; workDir?: string } = {}) {}

  async build(files: Files): Promise<BuildResult> {
    const base = this.options.workDir ?? tmpdir();
    await mkdir(base, { recursive: true });
    const dir = await mkdtemp(path.join(base, 'plugin-'));
    try {
      await writeFiles(dir, files);
      const { code, out } = await run(
        this.options.mavenCmd ?? 'mvn',
        ['clean', 'package', '-q', '-B'],
        dir,
        this.options.timeoutMs ?? 900_000
      );
      if (code !== 0) return { ok: false, log: out };
      const target = path.join(dir, 'target');
      const jar = (await readdir(target)).find(
        (n) => n.endsWith('.jar') && !n.includes('original')
      );
      if (!jar) return { ok: false, log: 'no jar produced\n' + out };
      return { ok: true, log: out, jar: await readFile(path.join(target, jar)) };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function run(cmd: string, args: string[], cwd: string, timeoutMs: number) {
  return new Promise<{ code: number; out: string }>((resolve) => {
    const p = spawn(cmd, args, { cwd });
    let out = '';
    const t = setTimeout(() => {
      p.kill('SIGKILL');
      out += '\nbuild timed out';
    }, timeoutMs);
    p.stdout.on('data', (d: Buffer) => (out += d));
    p.stderr.on('data', (d: Buffer) => (out += d));
    p.on('error', (e) => {
      clearTimeout(t);
      resolve({ code: 1, out: String(e) });
    });
    p.on('close', (c) => {
      clearTimeout(t);
      resolve({ code: c ?? 1, out });
    });
  });
}
