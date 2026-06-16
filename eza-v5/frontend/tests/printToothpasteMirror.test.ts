import { describe, expect, it } from 'vitest';
import { buildMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { buildMirrorV2ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import {
  TOOTHPASTE_CONVERSATION_ID,
  buildToothpasteMirrorEntries,
} from '@/lib/eza/mirror/conversationMirrorV2/toothpasteConversationFixture';

describe('printToothpasteMirror', () => {
  it('prints demo payload and OpenAI prompt', () => {
    const entries = buildToothpasteMirrorEntries();
    const payload = buildMirrorPayload(entries, {
      seed: 'toothpaste-demo-print',
      conversationId: TOOTHPASTE_CONVERSATION_ID,
      season: 'bright_cinematic',
    });
    const prompt = buildMirrorV2ImagePrompt(payload);

    // eslint-disable-next-line no-console
    console.log('\n--- SainaMirrorPayload ---\n', JSON.stringify(payload, null, 2));
    // eslint-disable-next-line no-console
    console.log('\n--- OpenAI Image Prompt ---\n', prompt);

    expect(payload.selectedTopic.length).toBeGreaterThan(3);
    expect(prompt.length).toBeGreaterThan(200);
  });
});
