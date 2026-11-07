import { z } from 'zod';
import { bundleSchema } from '../domain/schema.ts';

export const targets = [
  { id: 'gasper-lean4', repository: 'NyxFoundation/gasper-lean4', claimId: 'ffg-structural-safety',
    artifactIds: ['gasper-model', 'gasper-proof'] },
  { id: 'formal-leanSpec', repository: 'NyxFoundation/formal-leanSpec', claimId: 'checkpoint-forward',
    artifactIds: ['lstar-model', 'lstar-proof'] },
  { id: 'arklib', repository: 'Verified-zkEVM/ArkLib', claimId: 'kzg-correctness',
    artifactIds: ['ark-model', 'ark-proof'] },
] as const;
export type Target = typeof targets[number];
export const commitSchema = z.string().regex(/^[a-f0-9]{40}$/);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1).max(4000).regex(/^[\x20-\x7e\n]+$/);
export const reviewSchema = z.strictObject({
  reviewer: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/), notes: text.max(1000),
});
const bindingSchema = bundleSchema.shape.architectureViews.element.shape.claimBindings.element;
export const contentSchema = z.strictObject({
  artifacts: bundleSchema.shape.artifacts.max(8),
  claims: bundleSchema.shape.claims.max(8),
  evidence: bundleSchema.shape.evidence.max(20),
  bindings: z.array(z.strictObject({ viewId: bundleSchema.shape.architectureViews.element.shape.id,
    binding: bindingSchema })).max(50),
});
export const observationSchema = z.strictObject({
  artifactId: z.string().max(128), locationId: z.string().max(128), revision: commitSchema,
  path: z.string().min(1).max(500), checkedAt: z.iso.datetime(), sha256: hashSchema.nullable(),
});
export const proposalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  target: z.enum(['gasper-lean4', 'formal-leanSpec', 'arklib']),
  repository: z.string().max(200), branch: z.literal('main'),
  before: commitSchema, after: commitSchema, baseFingerprint: hashSchema,
  content: contentSchema, observations: z.array(observationSchema).max(100),
  review: reviewSchema.extend({ checkedAt: z.iso.datetime() }).nullable(),
});
export type Content = z.infer<typeof contentSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Review = z.infer<typeof reviewSchema>;
export interface SourceClient {
  main(target: Target): Promise<string>;
  source(target: Target, revision: string, path: string): Promise<string | null>;
}
export class IntakeError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export function requireIntake(value: unknown, code: string): asserts value {
  if (!value) throw new IntakeError(code);
}
export function targetFor(id: string): Target {
  const target = targets.find(t => t.id === id);
  requireIntake(target, 'unknown_target');
  return target;
}
export function sourcePath(path: string) {
  requireIntake(/^[A-Za-z0-9_./-]{1,500}$/.test(path) &&
    path.split('/').every(part => part && part !== '.' && part !== '..'), 'unsafe_source_path');
  return path.split('/').map(encodeURIComponent).join('/');
}
export function sourceUrl(target: Target, revision: string, path: string) {
  return `https://github.com/${target.repository}/blob/${commitSchema.parse(revision)}/${sourcePath(path)}`;
}
export function updateBranch(target: Target, revision?: string) {
  return `proof-updates/${target.id}/${revision ? commitSchema.parse(revision) : ''}`;
}
