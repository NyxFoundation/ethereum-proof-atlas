import { sourceUrl, targetFor, updateBranch, type Proposal } from './model.ts';

export function proposalReport(proposal: Proposal) {
  const target = targetFor(proposal.target);
  const observations = proposal.observations.filter(o => o.revision === proposal.after);
  const sources = observations.map(o => {
    const previous = proposal.observations.find(p => p.revision === proposal.before &&
      p.artifactId === o.artifactId && p.locationId === o.locationId);
    const status = o.sha256 === null ? 'Unavailable; review blocked' :
      previous?.sha256 === o.sha256 ? 'Same bytes; dependencies still require review' : 'Changed or old source unavailable';
    return `| ${o.artifactId} / ${o.locationId} | [Pinned source](${sourceUrl(target, proposal.after, o.path)}) | ${status} |`;
  });
  return [
    `## Update ${target.repository}`, '',
    `Track \`main\`: \`${proposal.before}\` → \`${proposal.after}\`.`,
    `[Full repository comparison](https://github.com/${target.repository}/compare/${proposal.before}...${proposal.after})`, '',
    'This draft contains a candidate, not a published claim or a proof replay.',
    'The comparison may include a non-fast-forward upstream change. Review the complete diff, imports and toolchain, not just the theorem file.',
    'Old source-review, comparison and replay records will not be inherited.', '',
    '| Source | Location | Byte observation |', '| --- | --- | --- |', ...sources, '',
    '## Review and publish', '',
    `1. Check out \`${updateBranch(target, proposal.after)}\` and run \`npm ci\`.`,
    `2. Inspect the pinned theorem/model sources. Edit \`updates/${target.id}.json\` where statements, assumptions, limits, versions, configurations, source paths/line anchors or applicability explanations changed.`,
    '3. If the property no longer holds or its scope cannot be established, close this PR. Do not approve it just because a file exists.',
    '4. Record your explicit source and applicability review (replace the example identity and notes):', '',
    '\`\`\`sh',
    `npm run proofs:accept -- --target ${target.id} --reviewer YOUR_LOGIN --notes "Describe your source and applicability review" --confirm-reviewed`,
    'npm run verify',
    '\`\`\`', '',
    `5. Commit both \`data/atlas.json\` and \`updates/${target.id}.json\`, push, mark ready and obtain review before merging.`,
    'Pending candidates fail the package gate. Merging the reviewed data changes the next packaged release; it does not deploy a site.',
    'The next hourly run skips this repository while the PR is open. A closed PR is not recreated for the same upstream commit.', '',
  ].join('\n');
}
