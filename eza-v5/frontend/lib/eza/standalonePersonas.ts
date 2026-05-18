/**
 * Standalone persona — presentation only (100 isim, 10 aile).
 * Kişilik etiketi değil; o oturumdaki konuşma tonunun sembolik adı.
 */

import type { UserObservationCategoryId } from '@/lib/eza/dailyObservation';

export type PersonaFamilyId =
  | 'curiosity_exploration'
  | 'decision_direction'
  | 'clarity_simplification'
  | 'ideation_creation'
  | 'deep_thinking'
  | 'sensitive_careful'
  | 'fast_practical'
  | 'planning_structure'
  | 'trust_verification'
  | 'balanced_calm';

export interface StandalonePersonaView {
  familyId: PersonaFamilyId;
  familyLabel: string;
  name: string;
  emoji: string;
  tagline: string;
}

const FAMILY_LABEL: Record<PersonaFamilyId, string> = {
  curiosity_exploration: 'Merak / Keşif',
  decision_direction: 'Karar / Yön Bulma',
  clarity_simplification: 'Netlik / Sadeleştirme',
  ideation_creation: 'Fikir Geliştirme',
  deep_thinking: 'Derin Düşünme',
  sensitive_careful: 'Hassas / Dikkatli',
  fast_practical: 'Hızlı / Pratik',
  planning_structure: 'Düzen / Planlama',
  trust_verification: 'Güven / Doğrulama',
  balanced_calm: 'Dengeli / Sakin',
};

const PERSONAS: Record<PersonaFamilyId, { name: string; emoji: string }[]> = {
  curiosity_exploration: [
    { name: 'Meraklı Dedektif', emoji: '🔍' },
    { name: 'Fikir Gezgini', emoji: '🧭' },
    { name: 'Soru Kaşifi', emoji: '✨' },
    { name: 'İhtimal Avcısı', emoji: '🌌' },
    { name: 'Açık Kapı Arayan', emoji: '🚪' },
    { name: 'Merak Pusulası', emoji: '🧭' },
    { name: 'Keşif Yolcusu', emoji: '🛤️' },
    { name: 'Bakış Açısı Toplayıcısı', emoji: '👁️' },
    { name: 'Yeni Fikir İzci', emoji: '🦊' },
    { name: 'Ufuk Tarayıcı', emoji: '🌅' },
  ],
  decision_direction: [
    { name: 'Yol Arayan', emoji: '🐧' },
    { name: 'Karar Eşiğindeki', emoji: '⚖️' },
    { name: 'Seçenek Tartıcısı', emoji: '🔀' },
    { name: 'Stratejik Haritacı', emoji: '🗺️' },
    { name: 'Yön Bulucu', emoji: '🧭' },
    { name: 'Mantık Terazisi', emoji: '⚖️' },
    { name: 'Sonuç Arayan', emoji: '🎯' },
    { name: 'İkilem Çözücü', emoji: '↔️' },
    { name: 'Rotasını Çizen', emoji: '✏️' },
    { name: 'Karar Öncesi Düşünen', emoji: '💭' },
  ],
  clarity_simplification: [
    { name: 'Netlik Avcısı', emoji: '💎' },
    { name: 'Sadeleştirici', emoji: '🪶' },
    { name: 'Kısa Yol Arayan', emoji: '➡️' },
    { name: 'Odak Toplayıcı', emoji: '🎯' },
    { name: 'Bulanıklık Dağıtan', emoji: '☀️' },
    { name: 'Net Cümle Seven', emoji: '📝' },
    { name: 'Sonuç Netleştirici', emoji: '✓' },
    { name: 'Keskin Odak', emoji: '🔹' },
    { name: 'Sade Cevap Arayan', emoji: '📋' },
    { name: 'Çerçeve Kurucu', emoji: '▢' },
  ],
  ideation_creation: [
    { name: 'Fikir Mimarı', emoji: '🏗️' },
    { name: 'Taslak Ustası', emoji: '✏️' },
    { name: 'İhtimal Üreticisi', emoji: '💡' },
    { name: 'Kurgucu', emoji: '🎬' },
    { name: 'Geliştirici Zihin', emoji: '🌱' },
    { name: 'Yaratıcı Yolcu', emoji: '🎨' },
    { name: 'Fikir Bahçıvanı', emoji: '🌿' },
    { name: 'Tasarımcı Bakış', emoji: '👁️' },
    { name: 'Senaryo Kurucu', emoji: '📖' },
    { name: 'Üretken Kaşif', emoji: '🦊' },
  ],
  deep_thinking: [
    { name: 'Derin Düşünen Kirpi', emoji: '🦔' },
    { name: 'Bağlam Arayan', emoji: '🔗' },
    { name: 'Katman Açıcı', emoji: '📚' },
    { name: 'Felsefi Yolcu', emoji: '🌙' },
    { name: 'Gerekçe Toplayıcı', emoji: '🧩' },
    { name: 'İnceleyen Zihin', emoji: '🔬' },
    { name: 'Anlam Avcısı', emoji: '💭' },
    { name: 'Düşünce Madencisi', emoji: '⛏️' },
    { name: 'Derinlik Arayıcı', emoji: '🌊' },
    { name: 'İç Bağlantı Kuran', emoji: '🕸️' },
  ],
  sensitive_careful: [
    { name: 'Dikkatli Yolcu', emoji: '🌿' },
    { name: 'Hassas Sinyal Taşıyan', emoji: '🟠' },
    { name: 'Temkinli Sorgulayan', emoji: '🛡️' },
    { name: 'Sınır Yoklayıcı', emoji: '〰️' },
    { name: 'Dikkat Noktası', emoji: '👁️' },
    { name: 'Kontrollü Arayıcı', emoji: '🎚️' },
    { name: 'İnce Çizgi Gezgini', emoji: '🧵' },
    { name: 'Duyarlı Konuşan', emoji: '💬' },
    { name: 'Sakin Sınır Arayan', emoji: '🌸' },
    { name: 'Güvenli Çerçeve Arayan', emoji: '🛡️' },
  ],
  fast_practical: [
    { name: 'Hızlı Netleştirici', emoji: '⚡' },
    { name: 'Pratik Çözücü', emoji: '🔧' },
    { name: 'Aksiyon Arayan', emoji: '🏃' },
    { name: 'Kısa Cevap Seven', emoji: '💬' },
    { name: 'Hızlı Yolcu', emoji: '🚀' },
    { name: 'Pratik Zihin', emoji: '📌' },
    { name: 'Çözüm Odaklı', emoji: '✅' },
    { name: 'Hızlı Karşılaştırıcı', emoji: '⚡' },
    { name: 'Net Adım Arayan', emoji: '👣' },
    { name: 'İş Bitirici Ton', emoji: '✓' },
  ],
  planning_structure: [
    { name: 'Planlayıcı', emoji: '📅' },
    { name: 'Sistem Kurucu', emoji: '🧱' },
    { name: 'Harita Çizen', emoji: '🗺️' },
    { name: 'Düzenleyici', emoji: '📂' },
    { name: 'Akış Tasarlayan', emoji: '〰️' },
    { name: 'Kontrol Noktası', emoji: '📍' },
    { name: 'Sıralayıcı', emoji: '🔢' },
    { name: 'Plan Mimarı', emoji: '🏛️' },
    { name: 'Yapılandırıcı', emoji: '📐' },
    { name: 'Rota Planlayıcı', emoji: '🧭' },
  ],
  trust_verification: [
    { name: 'Doğrulama Arayan', emoji: '🔎' },
    { name: 'Emin Olmak İsteyen', emoji: '✓' },
    { name: 'Sağlama Yapan', emoji: '🧪' },
    { name: 'Güven Testçisi', emoji: '🛡️' },
    { name: 'İkinci Bakış Arayan', emoji: '👀' },
    { name: 'Kanıt Arayan', emoji: '📎' },
    { name: 'Şüpheci Yolcu', emoji: '🤔' },
    { name: 'Net Güvence Arayan', emoji: '🔒' },
    { name: 'Kontrol Eden Zihin', emoji: '🎛️' },
    { name: 'Referans Arayan', emoji: '📚' },
  ],
  balanced_calm: [
    { name: 'Dengeli Yolcu', emoji: '🌿' },
    { name: 'Sakin Gözlemci', emoji: '🦌' },
    { name: 'Yumuşak Akış', emoji: '🌊' },
    { name: 'Dengeli Düşünen', emoji: '⚖️' },
    { name: 'Stabil İlerleyen', emoji: '🟢' },
    { name: 'Rahat Konuşan', emoji: '☁️' },
    { name: 'Uyumlu Akış', emoji: '💫' },
    { name: 'Sakin Ritim', emoji: '🎵' },
    { name: 'Dengede Kalan', emoji: '🪨' },
    { name: 'Yumuşak Geçiş', emoji: '🌸' },
  ],
};

const CATEGORY_TO_FAMILY: Record<UserObservationCategoryId, PersonaFamilyId> = {
  exploration: 'curiosity_exploration',
  decision_support: 'decision_direction',
  clarity_seek: 'clarity_simplification',
  creative_ideas: 'ideation_creation',
  intellectual_depth: 'deep_thinking',
  sensitive_signals: 'sensitive_careful',
  safe_balance: 'sensitive_careful',
  flow_harmony: 'balanced_calm',
  question_clarity: 'clarity_simplification',
  explanation_seek: 'trust_verification',
  balanced: 'balanced_calm',
  quiet: 'balanced_calm',
};

function pickIndex(variants: unknown[], seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 17)) | 0;
  }
  return Math.abs(h) % variants.length;
}

export function personaFamilyForCategory(
  category: UserObservationCategoryId | undefined
): PersonaFamilyId {
  if (!category) return 'balanced_calm';
  return CATEGORY_TO_FAMILY[category] ?? 'balanced_calm';
}

const PERSONA_FAMILY_IDS = new Set<string>(Object.keys(PERSONAS));

export function isPersonaFamilyId(value: string): value is PersonaFamilyId {
  return PERSONA_FAMILY_IDS.has(value);
}

export function pickStandalonePersona(
  category: UserObservationCategoryId | PersonaFamilyId | undefined,
  seed: string
): StandalonePersonaView {
  const familyId: PersonaFamilyId =
    category && isPersonaFamilyId(category)
      ? category
      : personaFamilyForCategory(category as UserObservationCategoryId | undefined);
  const pool = PERSONAS[familyId];
  const picked = pool[pickIndex(pool, `${seed}-persona`)]!;
  return {
    familyId,
    familyLabel: FAMILY_LABEL[familyId],
    name: picked.name,
    emoji: picked.emoji,
    tagline: `Bugünkü konuşma tonun ${picked.name} enerjisine yakın görünüyordu.`,
  };
}
