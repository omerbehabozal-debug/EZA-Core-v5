/**
 * Topic axis stability — last N messages share the same Topic DNA axis (deterministic V1).
 */

import { getCoverageTopicForToken } from '@/lib/eza/mirror/coverage/coverageLibrary';
import type { ConversationMirrorMessage } from '@/lib/eza/mirror/conversationMirrorEntries';
import { extractStoryCueTokens } from '@/lib/eza/mirror/storyTopicResolver';
import { getTopicForToken } from '@/lib/eza/mirror/storyTopicCueRegistry';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export const MIRROR_BIRTH_TOPIC_STABLE_MESSAGE_COUNT = 3;

function primaryTopicForText(text: string): StoryTopicId {
  const tokens = extractStoryCueTokens(text);
  for (const token of tokens) {
    const topic = getTopicForToken(token) ?? getCoverageTopicForToken(token);
    if (topic) return topic;
  }
  return 'general_curiosity';
}

export function areLastMessagesOnSameTopicAxis(
  messages: ConversationMirrorMessage[],
  count = MIRROR_BIRTH_TOPIC_STABLE_MESSAGE_COUNT
): boolean {
  const recent = messages.filter((message) => message.text.trim()).slice(-count);
  if (recent.length < count) return false;

  const topics = recent.map((message) => primaryTopicForText(message.text));
  const anchor = topics[0];
  return topics.every((topic) => topic === anchor);
}
