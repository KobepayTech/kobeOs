import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { basename, join, relative, resolve, sep } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class DeveloperGitService {
  private readonly root = resolve(process.env.KOBEOS_DEV_ROOT || join(process.cwd(), 'workspaces'));

  private safeRepo(repo: string) {
    const clean = String(repo || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const path = resolve(this.root, clean);
    const rel = relative(this.root, path);
    if (!clean || rel.startsWith('..') || rel.includes(`..${sep}`)) throw new BadRequestException('Invalid repository path');
    return path;
  }

  private async git(repo: string, args: string[], options: { allowFailure?: boolean } = {}) {
    const cwd = this.safeRepo(repo);
    try {
      const result = await execFileAsync('git', args, { cwd, timeout: 20_000, maxBuffer: 2_000_000, windowsHide: true });
      return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
    } catch (error) {
      if (options.allowFailure) return { stdout: '', stderr: (error as { stderr?: string }).stderr?.trim() || (error as Error).message };
      throw new BadRequestException((error as { stderr?: string }).stderr?.trim() || (error as Error).message);
    }
  }

  async listRepos() {
    await fs.mkdir(this.root, { recursive: true });
    const out: Array<{ repo: string; name: string }> = [];
    const scan = async (dir: string, depth: number) => {
      if (depth > 2) return;
      let entries: Awaited<ReturnType<typeof fs.readdir>>;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      if (entries.some((e) => e.isDirectory() && e.name === '.git')) {
        const repo = relative(this.root, dir).replace(/\\/g, '/');
        if (repo) out.push({ repo, name: basename(dir) });
        return;
      }
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
        await scan(join(dir, e.name), depth + 1);
      }
    };
    await scan(this.root, 0);
    return { root: this.root, repositories: out.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  async init(name: string) {
    const clean = String(name || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    if (!clean) throw new BadRequestException('Repository name required');
    const path = this.safeRepo(clean);
    await fs.mkdir(path, { recursive: true });
    await this.git(clean, ['init']);
    return this.status(clean);
  }

  async status(repo: string) {
    const path = this.safeRepo(repo);
    try { await fs.access(join(path, '.git')); } catch { throw new NotFoundException('Git repository not found'); }
    const [branch, porcelain, remote] = await Promise.all([
      this.git(repo, ['branch', '--show-current'], { allowFailure: true }),
      this.git(repo, ['status', '--porcelain=v1']),
      this.git(repo, ['remote', '-v'], { allowFailure: true }),
    ]);
    const files = porcelain.stdout.split('\n').filter(Boolean).map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }));
    return { repo, branch: branch.stdout || '(detached)', clean: files.length === 0, files, remotes: remote.stdout.split('\n').filter(Boolean) };
  }

  async log(repo: string, limit = 50) {
    const result = await this.git(repo, ['log', `-${Math.max(1, Math.min(200, limit))}`, '--date=iso-strict', '--pretty=format:%H%x09%h%x09%an%x09%ad%x09%s'], { allowFailure: true });
    return result.stdout.split('\n').filter(Boolean).map((line) => {
      const [sha, shortSha, author, date, ...subject] = line.split('\t');
      return { sha, shortSha, author, date, subject: subject.join('\t') };
    });
  }

  async branches(repo: string) {
    const result = await this.git(repo, ['branch', '--format=%(refname:short)%09%(HEAD)']);
    return result.stdout.split('\n').filter(Boolean).map((line) => {
      const [name, head] = line.split('\t');
      return { name, current: head === '*' };
    });
  }

  async commit(repo: string, message: string) {
    const clean = String(message || '').trim().slice(0, 300);
    if (!clean) throw new BadRequestException('Commit message required');
    await this.git(repo, ['add', '-A']);
    await this.git(repo, ['commit', '-m', clean]);
    return { status: await this.status(repo), log: await this.log(repo, 10) };
  }

  async checkout(repo: string, branch: string, create = false) {
    const clean = String(branch || '').trim();
    if (!/^[a-zA-Z0-9._\/-]{1,120}$/.test(clean) || clean.includes('..')) throw new BadRequestException('Invalid branch name');
    await this.git(repo, create ? ['checkout', '-b', clean] : ['checkout', clean]);
    return this.status(repo);
  }

  async sync(repo: string, direction: 'pull' | 'push') {
    await this.git(repo, [direction, '--ff-only'].filter((_, i) => direction === 'pull' || i === 0));
    return this.status(repo);
  }
}
