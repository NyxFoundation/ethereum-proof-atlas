import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../src/intake/github';
import { targets, updateBranch } from '../src/intake/model';

const revision = 'a'.repeat(40);
const repository = 'NyxFoundation/ethereum-proof-atlas';
const pull = (ref: string, repo: string | null = repository) => ({ head: { ref, repo: repo ? { full_name: repo } : null } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('GitHub proof source boundary', () => {
  it('should resolve main once and hash pinned source bytes without sending credentials to the raw host', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ object: { type: 'commit', sha: revision } }))
      .mockResolvedValueOnce(new Response('theorem bytes'));
    const client = new GitHubClient({ fetcher, token: 'test-secret' });
    const commit = await client.main(targets[0]);
    expect(await client.source(targets[0], commit, 'Proof.lean')).toBe(createHash('sha256').update('theorem bytes').digest('hex'));
    expect(fetcher.mock.calls[0][0]).toBe('https://api.github.com/repos/NyxFoundation/gasper-lean4/git/ref/heads/main');
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-secret' });
    expect(fetcher.mock.calls[1][0]).toBe(`https://raw.githubusercontent.com/NyxFoundation/gasper-lean4/${revision}/Proof.lean`);
    expect(fetcher.mock.calls[1][1]?.headers).not.toHaveProperty('Authorization');
    expect(fetcher.mock.calls.every(([, options]) => options?.redirect === 'error' && options.signal instanceof AbortSignal)).toBe(true);
  });

  it('should record only a source 404 as unavailable', async () => {
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })) });
    expect(await client.source(targets[0], revision, 'Proof.lean')).toBeNull();
    await expect(client.main(targets[0])).rejects.toThrow('github_http_404');
  });

  it.each([401, 403, 429, 500, 503])('should fail closed without exposing the response body on HTTP %s', async status => {
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('private details', { status })) });
    await expect(client.source(targets[0], revision, 'Proof.lean')).rejects.toThrow(`github_http_${status}`);
  });

  it('should sanitize a network, timeout or redirect failure', async () => {
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('sensitive URL and token')) });
    await expect(client.main(targets[0])).rejects.toThrow('github_request_failed');
  });

  it('should release the response reader when the source stream fails', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new TypeError('private connection failure')); } });
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)) });
    await expect(client.source(targets[0], revision, 'Proof.lean')).rejects.toThrow('github_request_failed');
    expect(stream.locked).toBe(false);
  });

  it('should reject oversized streamed content even without a content-length header', async () => {
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(2 * 1024 * 1024 + 1))) });
    await expect(client.source(targets[0], revision, 'Proof.lean')).rejects.toThrow('github_response_too_large');
  });

  it.each(['not json', JSON.stringify({ object: { type: 'commit', sha: 'main' } })])('should reject malformed commit responses', async body => {
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(body)) });
    await expect(client.main(targets[0])).rejects.toThrow('invalid_github_response');
  });

  it.each(['TimeoutError', 'AbortError'])('should report %s without leaking the thrown value', async name => {
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockRejectedValue(new DOMException('private request details', name)) });
    await expect(client.main(targets[0])).rejects.toThrow('github_timeout');
  });

  it('should reject an empty success response', async () => {
    const client = new GitHubClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })) });
    await expect(client.main(targets[0])).rejects.toThrow('empty_github_response');
  });

  it.each(['../private', '/absolute', 'A//B.lean', 'A/./B.lean', 'A/%2e%2e/B', 'A\\B.lean'])('should reject unsafe source path %s before fetching', async path => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new GitHubClient({ fetcher }).source(targets[0], revision, path)).rejects.toThrow('unsafe_source_path');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('update PR idempotence', () => {
  it('should find an open repository update beyond the first page and leave human work alone', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(Array.from({ length: 100 }, () => pull('unrelated'))))
      .mockResolvedValueOnce(json([pull(updateBranch(targets[0], revision))]));
    expect(await new GitHubClient({ fetcher }).hasOpenUpdate(repository, targets[0])).toBe(true);
    expect(fetcher.mock.calls[1][0]).toContain('page=2');
  });

  it('should ignore similarly named fork branches and other tracked repositories', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json([
      pull(updateBranch(targets[0], revision), 'someone/fork'), pull(updateBranch(targets[1], revision)), pull('unrelated', null),
    ]));
    expect(await new GitHubClient({ fetcher }).hasOpenUpdate(repository, targets[0])).toBe(false);
  });

  it('should stop rather than create duplicates if the PR listing exceeds its bound', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json(Array.from({ length: 100 }, () => pull('unrelated'))));
    await expect(new GitHubClient({ fetcher }).hasOpenUpdate(repository, targets[0])).rejects.toThrow('pull_request_list_too_large');
  });

  it('should not recreate a rejected or previously merged upstream revision', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json([pull(updateBranch(targets[0], revision))]));
    expect(await new GitHubClient({ fetcher }).existingCandidate(repository, targets[0], revision)).toBe('existing_pull_request');
    expect(fetcher.mock.calls[0][0]).toContain('state=all');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should preserve an orphaned branch after partial publication failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json({ ref: 'existing' }));
    expect(await new GitHubClient({ fetcher }).existingCandidate(repository, targets[0], revision)).toBe('existing_branch');
  });

  it('should permit only a genuinely new candidate branch', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json([])).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await new GitHubClient({ fetcher }).existingCandidate(repository, targets[0], revision)).toBeNull();
  });

  it('should reject an unsafe destination repository before fetching', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new GitHubClient({ fetcher }).hasOpenUpdate('../private', targets[0])).rejects.toMatchObject({ name: 'ZodError' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
