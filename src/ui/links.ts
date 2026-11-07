import type { Artifact } from '../domain/schema';

type RevisionedArtifact = Pick<Artifact, 'repository' | 'revision' | 'revisionKind'>;
// Git-commit revisions link to the repository state at that revision; a
// sha256 digest addresses artifact content and has no repository page.
export function revisionHref(artifact: RevisionedArtifact): string | null {
  return artifact.revisionKind === 'git-commit'
    ? `${artifact.repository}/tree/${artifact.revision}` : null;
}
