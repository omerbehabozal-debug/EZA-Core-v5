/**
 * Unified mirror state builder — delegates to V1, V2, or V3 pipeline.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildMirrorState,
  type BuildMirrorStateOptions,
} from '@/lib/eza/mirror/mirrorStateEngine';
import type { MirrorStateResult, MirrorPipelineVersion } from '@/lib/eza/mirror/types';
import { buildMirrorStateV2 } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorStateV2';
import { buildMirrorStateV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorStateV3';
import {
  isMirrorPipelineV2,
  isMirrorPipelineV3,
  resolveConversationMirrorPipelineVersion,
} from '@/lib/eza/mirror/conversationMirrorV2/resolvePipelineVersion';

export type BuildConversationMirrorStateOptions = BuildMirrorStateOptions & {
  pipelineVersion?: MirrorPipelineVersion;
};

export function buildConversationMirrorState(
  entries: SavedBehavioralEntry[],
  options?: BuildConversationMirrorStateOptions
): MirrorStateResult {
  const pipelineVersion = options?.conversationId
    ? resolveConversationMirrorPipelineVersion()
    : options?.pipelineVersion;

  if (isMirrorPipelineV3(pipelineVersion)) {
    return buildMirrorStateV3(entries, options);
  }
  if (isMirrorPipelineV2(pipelineVersion)) {
    return buildMirrorStateV2(entries, options);
  }
  return buildMirrorState(entries, options);
}

export {
  isMirrorPipelineV2,
  isMirrorPipelineV3,
  resolveMirrorPipelineVersion,
  resolveConversationMirrorPipelineVersion,
} from '@/lib/eza/mirror/conversationMirrorV2/resolvePipelineVersion';
