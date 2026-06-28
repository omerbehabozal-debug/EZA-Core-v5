import { describe, expect, it } from 'vitest';
import { buildMirrorCuriosityPipeline } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import {
  SAINA_MIRROR_PHILOSOPHY_MANIFESTO,
  SAINA_SHARE_ARCHITECTURE_MANIFESTO,
} from '@/lib/eza/mirror-network/philosophy';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { buildShareBlueprint } from '@/lib/eza/mirror-share/buildShareBlueprint';
import { buildShareVoice } from '@/lib/eza/mirror-share/buildShareVoice';
import {
  buildInstagramShareCaption,
  buildInstagramShareCaptionFromBlueprint,
} from '@/lib/eza/mirror-share/builders/instagram';
import {
  SHARE_EXPERIENCE_TITLE,
  SHARE_INVITATION_CONTINUE_QUESTIONS,
} from '@/lib/eza/mirror-share/shareExperienceCopy';
import { resolveMirrorShareCaption } from '@/lib/eza/mirror-share/resolveMirrorShareCaption';

const BASE_PAYLOAD = {
  mirrorTitle: 'Sokak Lambaları',
  mirrorText: 'internal only',
  sceneMetaphor: 'kyoto street lamps at dusk',
  topic: 'travel',
  storyTopicId: 'travel',
  conversationEvidence: [
    { label: 'Japonya seyahati', visualHint: 'kyoto evening street', weight: 1 },
  ],
} as unknown as SainaMirrorV3Payload;

describe('Share Architecture (Stage 4B Foundation)', () => {
  it('embeds four-surface manifesto in philosophy', () => {
    expect(SAINA_MIRROR_PHILOSOPHY_MANIFESTO).toContain('Caption creates intent');
    expect(SAINA_MIRROR_PHILOSOPHY_MANIFESTO).toContain('Caption never explains');
    expect(SAINA_SHARE_ARCHITECTURE_MANIFESTO).toContain('never celebrates');
  });

  it('produces shareVoice from Mirror Intelligence pipeline', () => {
    const pipeline = buildMirrorCuriosityPipeline(BASE_PAYLOAD);
    expect(pipeline.shareVoice?.text).toBeTruthy();
    expect(pipeline.shareVoice?.text.toLowerCase()).not.toContain('mirror');
    expect(pipeline.shareVoice?.text.toLowerCase()).not.toContain('sohbet');
    expect(pipeline.shareVoice?.text).toMatch(/akşam anlaşılır/i);
  });

  it('builds Share Blueprint from pipeline', () => {
    const pipeline = buildMirrorCuriosityPipeline(BASE_PAYLOAD);
    const blob = 'japonya kyoto travel';
    const blueprint = buildShareBlueprint(pipeline, blob);
    expect(blueprint.shareVoice).toBe('quiet_editorial_minimal');
    expect(blueprint.tone).toBe('editorial');
    expect(blueprint.invitationStyle).toBe('continue_questions');
  });

  it('builds three-layer Instagram caption with CTA + URL block', () => {
    const pipeline = buildMirrorCuriosityPipeline(BASE_PAYLOAD);
    const voice = pipeline.shareVoice ?? buildShareVoice(pipeline.seed, 'japonya kyoto');
    const caption = buildInstagramShareCaptionFromBlueprint(
      buildShareBlueprint(pipeline, 'japonya kyoto'),
      voice.text,
      'https://saina.app/m/sokak-lambalari'
    );

    expect(caption).toContain(voice.text);
    expect(caption).toContain(SHARE_INVITATION_CONTINUE_QUESTIONS);
    expect(caption).toContain('→ Buradan devam et.');
    expect(caption).toContain('saina.app/m/sokak-lambalari');
    expect(caption).not.toContain('Tebrikler');
    expect(caption).not.toContain('ChatGPT');
    expect(caption).not.toContain('AI ile konuştum');
  });

  it('omits URL bridge when shareUrl is not yet published', () => {
    const caption = buildInstagramShareCaption({
      captionLine: 'Bazı şehirler gündüz değil, akşam anlaşılır.',
      invitation: SHARE_INVITATION_CONTINUE_QUESTIONS,
      ctaLabel: '→ Buradan devam et.',
      shareUrl: null,
    });
    expect(caption).not.toContain('saina.app');
    expect(caption).not.toContain('━━━━━━━━');
  });

  it('Share Experience copy prepares without celebration', () => {
    expect(SHARE_EXPERIENCE_TITLE).toBe('Paylaşıma hazır');
    expect(SHARE_EXPERIENCE_TITLE.toLowerCase()).not.toContain('tebrik');
    expect(SHARE_EXPERIENCE_TITLE.toLowerCase()).not.toContain('harika');
  });

  it('resolveMirrorShareCaption uses share identity when mirrorV3 payload exists', () => {
    const pipeline = buildMirrorCuriosityPipeline(BASE_PAYLOAD);
    const text = resolveMirrorShareCaption({
      date: '2026-05-31',
      dayLabel: '31 Mayıs',
      headline: 'Sokak Lambaları',
      characterName: 'SAINA',
      personaFamilyId: 'balanced_calm',
      shortInsight: '',
      userLine: '',
      aiLine: '',
      balanceLine: '',
      signalLevel: '',
      confidence: '',
      energyLabel: '',
      energyScore: null,
      shareEnabled: true,
      privacyText: '',
      mirrorV3Payload: { ...BASE_PAYLOAD, curiosityBundle: pipeline },
      mirrorShare: {
        blueprint: buildShareBlueprint(pipeline, 'japonya kyoto'),
        shareVoice: pipeline.shareVoice!,
        shareUrl: 'https://saina.app/m/sokak-lambalari',
      },
    });

    expect(text).toContain('Buradan devam et');
    expect(text).toContain('saina.app/m/sokak-lambalari');
  });
});
