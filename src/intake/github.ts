import { createHash } from 'node:crypto';
import { z } from 'zod';
import { commitSchema, IntakeError, requireIntake, sourcePath, updateBranch, type SourceClient, type Target } from './model.ts';

const repositorySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/);
const pullSchema = z.object({ head: z.object({ ref: z.string(), repo: z.object({ full_name: z.string() }).nullable() }) });
const limit = 2 * 1024 * 1024;
function apiResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  requireIntake(result.success, 'invalid_github_response');
  return result.data;
}
export class GitHubClient implements SourceClient {
  private readonly fetcher: typeof fetch;
  private readonly token?: string;
  constructor(options: { fetcher?: typeof fetch; token?: string } = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.token = options.token;
  }
  private async request(url: string, api: boolean, missing = false): Promise<Uint8Array | null> {
    try {
      const headers: Record<string, string> = { 'User-Agent': 'ethereum-proof-atlas-intake' };
      if (api) {
        headers.Accept = 'application/vnd.github+json';
        headers['X-GitHub-Api-Version'] = '2022-11-28';
        if (this.token) headers.Authorization = `Bearer ${this.token}`;
      }
      const response = await this.fetcher(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20_000) });
      if (response.status === 404 && missing) { await response.body?.cancel(); return null; }
      if (!response.ok) { await response.body?.cancel(); throw new IntakeError(`github_http_${response.status}`); }
      const reader = response.body?.getReader();
      requireIntake(reader, 'empty_github_response');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) { await reader.cancel(); throw new IntakeError('github_response_too_large'); }
          chunks.push(value);
        }
        return Buffer.concat(chunks);
      } finally { reader.releaseLock(); }
    } catch (error) {
      if (error instanceof IntakeError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new IntakeError('github_timeout');
      throw new IntakeError('github_request_failed');
    }
  }
  private async json(path: string, missing = false): Promise<unknown> {
    const bytes = await this.request(`https://api.github.com${path}`, true, missing);
    if (bytes === null) return null;
    try { return JSON.parse(Buffer.from(bytes).toString('utf8')); }
    catch { throw new IntakeError('invalid_github_response'); }
  }
  async main(target: Target) {
    const result = await this.json(`/repos/${target.repository}/git/ref/heads/main`);
    return apiResponse(z.object({ object: z.object({ type: z.literal('commit'), sha: commitSchema }) }), result).object.sha;
  }
  async source(target: Target, revision: string, path: string) {
    const url = `https://raw.githubusercontent.com/${target.repository}/${commitSchema.parse(revision)}/${sourcePath(path)}`;
    const bytes = await this.request(url, false, true);
    return bytes === null ? null : createHash('sha256').update(bytes).digest('hex');
  }
  async hasOpenUpdate(repository: string, target: Target) {
    const repo = repositorySchema.parse(repository);
    for (let page = 1; page <= 10; page++) {
      const result = apiResponse(z.array(pullSchema).max(100), await this.json(`/repos/${repo}/pulls?state=open&per_page=100&page=${page}`));
      if (result.some(p => p.head.repo?.full_name === repo && p.head.ref.startsWith(updateBranch(target)))) return true;
      if (result.length < 100) return false;
    }
    throw new IntakeError('pull_request_list_too_large');
  }
  async existingCandidate(repository: string, target: Target, revision: string) {
    const repo = repositorySchema.parse(repository);
    const branch = updateBranch(target, revision);
    const query = new URLSearchParams({ state: 'all', head: `${repo.split('/')[0]}:${branch}`, per_page: '100' });
    const pulls = apiResponse(z.array(pullSchema).max(100), await this.json(`/repos/${repo}/pulls?${query}`));
    if (pulls.some(p => p.head.repo?.full_name === repo && p.head.ref === branch)) return 'existing_pull_request';
    if (await this.json(`/repos/${repo}/git/ref/heads/${branch}`, true) !== null) return 'existing_branch';
    return null;
  }
}
