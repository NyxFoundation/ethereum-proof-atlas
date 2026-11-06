import { z } from 'zod';

// Object-schema JIT uses new Function, which the production CSP forbids.
z.config({ jitless: true });

export const SCHEMA_VERSION = 1;
export const idSchema = z.string().regex(/^[A-Za-z0-9._~-]{1,128}$/);
const text = z.string().min(1).max(6000).regex(/^[\x20-\x7e\n]+$/);
const ids = z.array(idSchema).max(2000);
const texts = z.array(text).max(100);
export const httpsUrl = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return value.startsWith('https://') && url.protocol === 'https:' &&
      !!url.hostname && !url.username && !url.password && !/[\s\\]/.test(value);
  } catch { return false; }
}, 'Source URLs must be absolute HTTPS URLs without credentials.');
export const sourceSchema = z.strictObject({ artifactId: idSchema, locationId: idSchema });
const sources = z.array(sourceSchema).min(1).max(100);
const knowledge = z.strictObject({ status: z.enum(['known', 'unknown']), details: texts.min(1) });
const position = z.strictObject({ x: z.number().min(-5000).max(5000), y: z.number().min(-5000).max(5000) });

const component = z.strictObject({
  id: idSchema, name: text, area: z.enum(['consensus', 'execution', 'cryptography', 'networking', 'serialization', 'development']),
  description: text, childComponentIds: ids,
});
const artifact = z.strictObject({
  id: idSchema, title: text, kind: z.enum(['specification', 'formal-model', 'implementation', 'proof']),
  repository: httpsUrl, revisionKind: z.enum(['git-commit', 'sha256']),
  revision: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/), version: text,
  locations: z.array(z.strictObject({ id: idSchema, path: text, label: text, url: httpsUrl })).min(1).max(500),
});
const claim = z.strictObject({
  id: idSchema, title: text, statement: text, subjectArtifactIds: ids.min(1),
  assumptions: knowledge, dependencies: knowledge, limitations: texts.min(1),
  relation: z.strictObject({ kind: z.enum(['refinement', 'equivalence']),
    fromArtifactId: idSchema, toArtifactId: idSchema, direction: text }).nullable(),
});
const scope = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('unbounded'), statement: text, abstractions: texts.min(1), configuration: text }),
  z.strictObject({ kind: z.literal('bounded'), statement: text, bounds: texts.min(1), abstractions: texts.min(1), configuration: text }),
]);
const evidence = z.strictObject({
  id: idSchema, claimId: idSchema, artifactId: idSchema, locationId: idSchema,
  method: z.enum(['theorem-proving', 'smt', 'model-checking']), scope,
});
const checkBase = { id: idSchema, checkedAt: z.iso.datetime(), details: text };
const evidenceCheck = { artifactId: idSchema, evidenceId: idSchema, subjectArtifactIds: ids.min(1), scope: text };
const checkRecord = z.discriminatedUnion('kind', [
  z.strictObject({ ...checkBase, kind: z.literal('availability'), artifactId: idSchema,
    locationIds: ids.min(1), result: z.enum(['available', 'unavailable']) }),
  z.strictObject({ ...checkBase, ...evidenceCheck, kind: z.literal('source-review'), result: z.enum(['reviewed', 'inconclusive']) }),
  z.strictObject({ ...checkBase, ...evidenceCheck, kind: z.literal('replay'),
    configuration: text, result: z.enum(['passed', 'failed', 'timeout', 'error']) }),
  z.strictObject({ ...checkBase, kind: z.literal('manual-comparison'), viewId: idSchema,
    componentInstanceId: idSchema, claimId: idSchema, sources, result: z.literal('related') }),
]);
const binding = z.strictObject({
  componentInstanceId: idSchema, claimId: idSchema,
  applicabilityKind: z.enum(['direct-subject', 'related-model']), explanation: text, sources,
  basis: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('version-match') }),
    z.strictObject({ kind: z.literal('source-cross-reference'), explanation: text }),
    z.strictObject({ kind: z.literal('manual-comparison'), checkId: idSchema }),
  ]),
});
const architectureView = z.strictObject({
  id: z.enum(['beacon', 'lean', 'execution']), label: z.enum(['Beacon Spec', 'Lean Spec', 'Execution Spec']),
  fork: text, experimental: z.boolean(), description: text, sources, inheritance: texts.min(1),
  componentInstances: z.array(z.strictObject({ instanceId: idSchema, componentId: idSchema,
    subjectArtifactIds: ids.min(1), sources, position, parentInstanceId: idSchema.nullable() })).min(1).max(200),
  claimBindings: z.array(binding).max(2000),
});
const architectureEdge = z.strictObject({
  id: idSchema, viewId: idSchema, source: idSchema, target: idSchema,
  kind: z.enum(['dependency', 'interface', 'generated-code']), label: text, explanation: text, sources,
});
export const bundleSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION), datasetRevision: z.string().regex(/^[a-f0-9]{64}$/),
  components: z.array(component).max(2000), artifacts: z.array(artifact).max(2000),
  claims: z.array(claim).max(5000), evidence: z.array(evidence).max(10000),
  checkRecords: z.array(checkRecord).max(20000),
  architectureViews: z.array(architectureView).length(3), architectureEdges: z.array(architectureEdge).max(2000),
});
export type AtlasBundle = z.infer<typeof bundleSchema>;
export type Component = AtlasBundle['components'][number];
export type ArchitectureView = AtlasBundle['architectureViews'][number];
export type ComponentInstance = ArchitectureView['componentInstances'][number];
export type ClaimBinding = ArchitectureView['claimBindings'][number];
export type Claim = AtlasBundle['claims'][number];
export type Artifact = AtlasBundle['artifacts'][number];
export type Evidence = AtlasBundle['evidence'][number];
export type CheckRecord = AtlasBundle['checkRecords'][number];
export type SourceReference = z.infer<typeof sourceSchema>;
export const selectionSchema = z.strictObject({ view: idSchema.nullable(), component: idSchema.nullable(), claim: idSchema.nullable() });
export type Selection = z.infer<typeof selectionSchema>;
export const responseSchema = z.strictObject({ schemaVersion: z.literal(SCHEMA_VERSION),
  datasetRevision: z.string().regex(/^[a-f0-9]{64}$/), selection: selectionSchema, bundle: bundleSchema });
