/**
 * Test Seed Content for Influencer Use Case
 * Topic: Detoks içeceği
 * Risk: Sağlık iddiaları
 * Expected: Rewrite Score must be HIGHER than original
 */

export const TEST_SEED_CONTENT = `Bu detoks içeceği gerçekten zayıflatıyor! 7 günde 5 kilo verdim ve artık hiç açlık hissetmiyorum. İçindeki özel karışım sayesinde metabolizmanızı hızlandırıyor ve yağ yakımını artırıyor. 

Her sabah aç karnına içtiğinizde, vücudunuzdaki toksinleri temizliyor ve bağırsaklarınızı düzenliyor. Bu sayede hem kilo veriyorsunuz hem de daha sağlıklı oluyorsunuz.

Deneyen herkes memnun! Artık diyet yapmanıza gerek yok, sadece bu içeceği için ve kilo verin. Garanti ediyorum ki 1 hafta içinde sonuçları göreceksiniz!`;

export const EXPECTED_ORIGINAL_SCORE = 30; // Low score due to health claims
export const EXPECTED_REWRITE_SCORE = 85; // High score after ethical rewrite

