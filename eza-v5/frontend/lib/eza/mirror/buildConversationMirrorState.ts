/**
 * Unified mirror state builder — delegates to V1 or V2 pipeline.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildMirrorState,
  type BuildMirrorStateOptions,
} from '@/lib/eza/mirror/mirrorStateEngine';
import type { MirrorStateResult, MirrorPipelineVersion } from '@/lib/eza/mirror/types';
import { buildMirrorStateV2 } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorStateV2';
import { isMirrorPipelineV2 } from '@/lib/eza/mirror/conversationMirrorV2/resolvePipelineVersion';

export type BuildConversationMirrorStateOptions = BuildMirrorStateOptions & {
  pipelineVersion?: MirrorPipelineVersion;
};

export function buildConversationMirrorState(
  entries: SavedBehavioralEntry[],
  options?: BuildConversationMirrorStateOptions
): MirrorStateResult {
  if (isMirrorPipelineV2(options?.pipelineVersion)) {
    return buildMirrorStateV2(entries, options);
  }
  return buildMirrorState(entries, options);
}

export { isMirrorPipelineV2, resolveMirrorPipelineVersion } from '@/lib/eza/mirror/conversationMirrorV2/resolvePipelineVersion';
