/**
 * Mirror V2 demo — diş macunu seçimi aktif sohbet thread'i.
 * OpenAI konu seçmez; mesajlardan SAINA topic extraction yapar.
 */

import {
  buildConversationMirrorEntries,
  type ConversationMirrorMessage,
} from '@/lib/eza/mirror/conversationMirrorEntries';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

export const TOOTHPASTE_CONVERSATION_ID = 'demo-toothpaste-thread';

export const TOOTHPASTE_CONVERSATION_MESSAGES: ConversationMirrorMessage[] = [
  {
    id: 'tp-1u',
    text: 'Diş macunu seçerken florürlü mü florürsüz mü almak daha mantıklı?',
    isUser: true,
    timestamp: new Date('2026-05-31T10:00:00Z'),
  },
  {
    id: 'tp-1a',
    text: 'Genel olarak çürük riskini azaltmak için florürlü diş macunları daha çok önerilir. Ancak kişisel durum, hassasiyet ve diş hekiminin tavsiyesi önemlidir.',
    isUser: false,
    assistantScore: 84,
    timestamp: new Date('2026-05-31T10:01:00Z'),
  },
  {
    id: 'tp-2u',
    text: 'Peki hassas dişler için olan diş macunları gerçekten işe yarıyor mu?',
    isUser: true,
    timestamp: new Date('2026-05-31T10:02:00Z'),
  },
  {
    id: 'tp-2a',
    text: 'Hassasiyet için üretilen macunlarda potasyum nitrat veya kalay florür gibi içerikler bulunabilir. Düzenli kullanımda bazı kişilerde hassasiyet azalabilir.',
    isUser: false,
    assistantScore: 86,
    timestamp: new Date('2026-05-31T10:03:00Z'),
  },
  {
    id: 'tp-3u',
    text: 'Beyazlatıcı diş macunları dişe zarar verir mi?',
    isUser: true,
    timestamp: new Date('2026-05-31T10:04:00Z'),
  },
  {
    id: 'tp-3a',
    text: 'Aşındırıcı oranı yüksek ürünler uzun süre ve yoğun kullanıldığında mine üzerinde yıpratıcı olabilir. Daha yumuşak formüller ve diş hekimi önerisi güvenli seçim için önemlidir.',
    isUser: false,
    assistantScore: 88,
    timestamp: new Date('2026-05-31T10:05:00Z'),
  },
  {
    id: 'tp-4u',
    text: 'Ben aslında hem hassasiyeti artırmasın hem de temiz ve güvenli hissettirsin istiyorum.',
    isUser: true,
    timestamp: new Date('2026-05-31T10:06:00Z'),
  },
  {
    id: 'tp-4a',
    text: 'Hassasiyeti artırmayan ve güven veren bir seçim için yumuşak formüllü, florürlü ve hassasiyet odaklı ürünleri birlikte değerlendirmek mantıklı olabilir.',
    isUser: false,
    assistantScore: 90,
    timestamp: new Date('2026-05-31T10:07:00Z'),
  },
];

export function buildToothpasteMirrorEntries(): SavedBehavioralEntry[] {
  return buildConversationMirrorEntries(TOOTHPASTE_CONVERSATION_MESSAGES);
}
