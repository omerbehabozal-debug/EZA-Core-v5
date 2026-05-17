/**
 * EZA Standalone observation copy pools — 100+ varyasyon.
 * Governance: kısa nötr setler · Standalone: samimi gözlemci setler.
 */

import type { UserObservationCategoryId } from '@/lib/eza/dailyObservation';
import type { ToneVariants } from '@/lib/eza/presentationTone';

export interface CategoryObservationCopy {
  user: ToneVariants;
  ai: ToneVariants;
  balance: ToneVariants;
  primaryInsight: ToneVariants;
  /** Her eleman 2 maddelik “neden böyle dedi?” seti */
  whyBulletSets: { standalone: string[][]; governance: string[][] };
  manset?: ToneVariants;
}

function gov(...lines: string[]): string[] {
  return lines;
}

function st(...lines: string[]): string[] {
  return lines;
}

/** Nadiren — belirgin fark / önceki oturum değişimi */
export const RARE_WOW_INSIGHTS: ToneVariants = {
  standalone: st(
    'Son etkileşimlerde önceki döneme göre daha fazla karşılaştırma eğilimi oluştu.',
    'Bugün konuşma ritmi önceki akışlara göre daha hızlı ilerledi.',
    'AI yanıtları bugün daha temkinli bir çizgiye geçti.',
    'Bazı konuşmalarda soru yapın daha fazla yön arayışı taşıdı.',
    'Son konuşmalarda keşif tonu belirgin şekilde öne çıktı.',
    'Bugün hassas sinyallere rağmen denge güçlü kaldı.',
    'Son etkileşimlerde açıklama arayışı daha görünür hale geldi.',
    'Bugünkü konuşmalarda “önce anlamak, sonra karar vermek” akışı hissedildi.'
  ),
  governance: gov(
    'Önceki döneme göre karşılaştırma eğilimi arttı.',
    'Oturum ritmi önceki ölçümlere göre hızlandı.',
    'Yanıt tonu daha temkinli bir çizgiye geçti.',
    'Keşif sinyali belirginleşti.',
    'Hassas sinyale rağmen denge korundu.',
    'Açıklama arayışı görünürleşti.'
  ),
};

export const OBSERVATION_COPY_POOLS: Record<UserObservationCategoryId, CategoryObservationCopy> = {
  exploration: {
    user: {
      standalone: st(
        'Bugünkü konuşmalarda yeni fikirleri keşfetme isteği daha belirgindi.',
        'Bugün farklı ihtimalleri karşılaştırmaya daha açıktın.',
        'Bazı sorularında merak duygusu daha baskındı.',
        'Bugün cevaplardan çok yeni bakış açıları arıyor gibiydin.',
        'Konuşma akışı yeni olasılıkları yoklamaya yöneldi.',
        'Bugünkü sorular daha çok “başka ne olabilir?” hissi taşıyordu.',
        'Son konuşmalarda keşif tonu kısa süreliğine öne çıktı.',
        'Bugün alternatifleri sıraya koyma isteği dikkat çekiyordu.'
      ),
      governance: gov(
        'Keşif odaklı girdi sinyali gözlemlendi.',
        'Son oturumda farklı ihtimal arayışı belirginleşti.'
      ),
    },
    ai: {
      standalone: st(
        'AI daha fazla seçenek ve ihtimal üretmeye çalıştı.',
        'Yanıtlar keşif alanını genişleten bir ton taşıyordu.',
        'AI farklı bakış açıları sunmaya daha yatkın görünüyordu.',
        'Yanıtlar tek cevaptan çok alternatifler üzerinden ilerledi.',
        'AI yeni olasılıkları açan bir yapı kullandı.',
        'Yanıt tonu merak alanını genişletmeye yöneldi.'
      ),
      governance: gov(
        'Yanıtlar alternatif üretimine yöneldi.',
        'Çıktılar keşif alanını genişletti.'
      ),
    },
    balance: {
      standalone: st(
        'Konuşma akışı keşif odaklı ama dengeli ilerledi.',
        'Merak sinyali güçlüydü, denge korunmuş görünüyordu.',
        'Etkileşim yeni fikirleri açarken kontrolünü kaybetmedi.',
        'Keşif tonu belirgindi, konuşma yine sakin seyretti.',
        'Yeni ihtimaller açıldı, akış dağılmadan sürdü.',
        'Keşif baskındı, etkileşim dengesi stabil kaldı.'
      ),
      governance: gov('Keşif tonu dengeli kaldı.', 'Etkileşim dengesi korundu.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün keşif tarafın daha belirgindi.',
        'Yeni fikir arayışı bugün öne çıktı.',
        'Bugünkü konuşmalar daha çok keşif taşıyordu.',
        'Merak ve keşif sinyali bugün öne çıkıyordu.',
        'Bugün farklı ihtimaller etrafında şekillendin.'
      ),
      governance: gov('Keşif odaklı etkileşim.', 'Keşif sinyali belirginleşti.'),
    },
    whyBulletSets: {
      standalone: [
        ['Soru yapısı farklı ihtimalleri açmaya yöneldi.', 'Yanıtlar tek sonuç yerine seçenekler etrafında şekillendi.'],
        ['Konuşma yeni bakış açıları aradı.', 'AI yanıtları alternatifler üretti.'],
        ['Merak sinyali soru yapısında belirgindi.', 'Yanıt tonu keşif alanını genişletti.'],
      ],
      governance: [
        ['Girdi keşif sinyali taşıdı.', 'Yanıtlar çoklu seçenek yapısı kullandı.'],
      ],
    },
    manset: {
      standalone: st('Keşif tonu öne çıktı.', 'Merak sinyali belirgindi.', 'Yeni ihtimaller gündemdeydi.'),
      governance: gov('Keşif tonu öne çıktı.'),
    },
  },

  decision_support: {
    user: {
      standalone: st(
        'Bugün bazı konularda yön bulmaya çalışıyor gibiydin.',
        'Bazı sorular karar öncesi netlik arayışı taşıyordu.',
        'Bugün AI’dan daha fazla fikir doğrulaması almaya çalıştın.',
        'Karar vermeden önce seçenekleri tartıyor gibiydin.',
        'Bugünkü konuşmalarda cevaplardan çok yön arayışı vardı.',
        'Bazı sorularında “hangisi daha mantıklı?” hissi öne çıkıyordu.',
        'Bugün seçenekleri yan yana koyma isteği belirgindi.',
        'Konuşma akışı karar öncesi netliğe yakındı.'
      ),
      governance: gov(
        'Karar desteği arayışı gözlemlendi.',
        'Karar öncesi netlik sinyali belirginleşti.'
      ),
    },
    ai: {
      standalone: st(
        'Yanıtlar daha açıklayıcı ve yön gösterici bir ton taşıyordu.',
        'AI seçenekleri düzenlemeye ve karşılaştırmaya çalıştı.',
        'Yanıtlar karar alanını netleştirmeye dönük ilerledi.',
        'AI daha fazla çerçeve sunan bir cevap yapısı kullandı.',
        'Yanıtlar seçenekleri ayıran bir yapı kurdu.',
        'AI karar alanını açan ama baskı kurmayan bir ton kullandı.'
      ),
      governance: gov('Yanıtlar karar çerçevesi sundu.', 'Çıktılar seçenek karşılaştırması içerdi.'),
    },
    balance: {
      standalone: st(
        'Karar arayışına rağmen etkileşim dengesi korundu.',
        'AI yön gösterdi ama konuşma kontrolü sende kaldı.',
        'Seçenekler açıldı, karar baskısı belirginleşmedi.',
        'Yön arayışı vardı, denge yine sakin kaldı.',
        'Karar öncesi netlik öne çıktı, akış kontrollü sürdü.',
        'Yön sinyali güçlüydü, etkileşim dengesi bozulmadı.'
      ),
      governance: gov('Karar arayışına yanıt tonu uyumlu kaldı.', 'Denge korundu.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün yön bulma isteği öne çıktı.',
        'Karar desteği bugün daha belirgindi.',
        'Bugünkü konuşmalar seçenekleri tartmaya yakındı.',
        'Karar öncesi netlik bugün öne çıkıyordu.'
      ),
      governance: gov('Karar desteği arayışı belirginleşti.', 'Yön arayışı gözlemlendi.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sorular karar öncesi netlik arayışı taşıyordu.', 'Yanıtlar seçenekleri ayıran bir yapı kurdu.'],
        ['Soru yapısı yön arayışı içeriyordu.', 'Yanıt tonu çerçeve sunmaya yöneldi.'],
        ['Karar alanı açıldı.', 'Etkileşim dengesi korunarak ilerledi.'],
      ],
      governance: [['Karar öncesi netlik sinyali vardı.', 'Yanıtlar seçenek düzeni sundu.']],
    },
    manset: {
      standalone: st('Karar öncesi netlik öne çıktı.', 'Seçenekleri anlama odağı belirdi.'),
      governance: gov('Karar desteği öne çıktı.'),
    },
  },

  clarity_seek: {
    user: {
      standalone: st(
        'Bugünkü sorular daha doğrudan ve net bir yapıdaydı.',
        'Bugün cevaplardan çok netlik almaya çalışıyor gibiydin.',
        'Bazı sorularında hızlı açıklık arayışı dikkat çekiyordu.',
        'Bugünkü konuşmalarda kısa ve kesin cevap beklentisi öne çıktı.',
        'Soru yapın bugün daha hedef odaklı görünüyordu.',
        'Bugün konuları dağıtmadan sonuca gitmeye çalıştın.',
        'Netlik ihtiyacı bugün soru yapısında belirgindi.',
        'Bugün “net cevap” beklentisi konuşmaya yansıdı.'
      ),
      governance: gov('Netlik arayışı gözlemlendi.', 'Doğrudan soru yapısı belirginleşti.'),
    },
    ai: {
      standalone: st(
        'AI daha kısa ve açıklayıcı yanıtlar vermeye yöneldi.',
        'Yanıtlar konuyu sadeleştiren bir yapı taşıyordu.',
        'AI cevapları daha net bir çerçevede tutmaya çalıştı.',
        'Yanıt tonu daha toparlayıcı görünüyordu.',
        'Yanıtlar hedefe odaklı ve sade kaldı.',
        'AI konuyu dağıtmadan netleştirmeye çalıştı.'
      ),
      governance: gov('Yanıtlar sadeleştirici yapı taşıdı.', 'Çıktılar net çerçeve kullandı.'),
    },
    balance: {
      standalone: st(
        'Konuşma akışı hedef odaklı ilerledi.',
        'Netlik arayışı belirgindi, etkileşim dengesi korundu.',
        'Cevaplar sadeleşti, konuşma kontrollü kaldı.',
        'Kısa cevap ihtiyacı öne çıktı ama denge bozulmadı.',
        'Hedef odaklı akış sürdü, ton sakin kaldı.',
        'Netlik baskındı, etkileşim dengesi stabil seyretti.'
      ),
      governance: gov('Netlik arayışı dengeli seyretti.', 'Denge korundu.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün netlik arayışı öne çıktı.',
        'Konuşmalar daha hedef odaklı ilerledi.',
        'Bugünkü akış daha sade ve netti.',
        'Netlik sinyali bugün belirgindi.'
      ),
      governance: gov('Netlik arayışı öne çıktı.', 'Hedef odaklı ton.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sorular daha kısa ve doğrudan kuruldu.', 'Yanıtlar konuyu toparlamaya dönük ilerledi.'],
        ['Soru yapısı netlik aradı.', 'Yanıt tonu sadeleştirici kaldı.'],
        ['Hedef odaklı akış vardı.', 'Etkileşim dengesi korundu.'],
      ],
      governance: [['Doğrudan soru yapısı gözlemlendi.', 'Yanıtlar toparlayıcı ilerledi.']],
    },
    manset: {
      standalone: st('Netlik arayışı öne çıktı.', 'Bugün netlik sinyali belirgindi.'),
      governance: gov('Netlik arayışı öne çıktı.'),
    },
  },

  sensitive_signals: {
    user: {
      standalone: st(
        'Bazı konularda daha dikkatli bir konuşma tonu vardı.',
        'Bugün bazı girişlerde dikkat gerektiren sinyaller oluştu.',
        'Bugünkü konuşmalarda hassas konu sinyalleri daha belirgindi.',
        'Bazı sorular daha temkinli yanıt gerektiren bir alan açtı.',
        'Konuşma içinde hassas sinyaller kısa süreliğine öne çıktı.',
        'Bugün bazı başlıklar daha dikkatli ele alınmayı gerektirdi.',
        'Hassas ton bugün kısa aralıklarla belirgindi.',
        'Bazı girişlerde dikkat sinyali öne çıkıyordu.'
      ),
      governance: gov(
        'Hassas konu sinyalleri belirginleşti.',
        'Dikkat gerektiren girdi gözlemlendi.'
      ),
    },
    ai: {
      standalone: st(
        'AI hassas girişlerde daha temkinli yanıtlar verdi.',
        'AI güvenli sınırları koruyarak yanıt vermeye çalıştı.',
        'Yanıtlar hassas noktalarda daha kontrollü bir ton taşıdı.',
        'AI bazı başlıklarda güvenli çerçeveyi öne aldı.',
        'Yanıtlar dikkat gerektiren girişlerde ölçülü kaldı.',
        'AI hassas alanlarda sınırı net ama sakin tuttu.'
      ),
      governance: gov('Yanıtlar temkinli ton taşıdı.', 'Güvenli sınır korundu.'),
    },
    balance: {
      standalone: st(
        'Hassas sinyallere rağmen konuşma dengesi korundu.',
        'Dikkat gerektiren girişlere rağmen yanıt tonu sakin kaldı.',
        'AI sınırları korudu, etkileşim dengesi bozulmadı.',
        'Hassas konu vardı ama konuşma güvenli çizgide kaldı.',
        'Hassas sinyal öne çıktı, genel akış kopmadı.',
        'Dikkat sinyali vardı, denge yine korunmuş görünüyordu.'
      ),
      governance: gov('Hassas sinyale rağmen denge korundu.', 'Etkileşim dengesi stabil kaldı.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün hassas sinyaller kısa süreliğine öne çıktı.',
        'Bazı başlıklar daha dikkatli ele alındı.',
        'Hassas girişlere rağmen denge korundu.',
        'Dikkat gerektiren ton bugün belirgindi.'
      ),
      governance: gov('Hassas sinyal yoğunluğu dikkat çekti.', 'Dikkat gerektiren girdi.'),
    },
    whyBulletSets: {
      standalone: [
        ['Bazı girişler daha temkinli yanıt gerektiren sinyaller taşıdı.', 'AI yanıtları güvenli sınırları koruyan bir ton kullandı.'],
        ['Hassas sinyal kısa süreli öne çıktı.', 'Yanıt tonu kontrollü kaldı.'],
        ['Girdi sinyali dikkat gerektirdi.', 'Etkileşim dengesi korundu.'],
      ],
      governance: [['Hassas girdi sinyali vardı.', 'Yanıtlar güvenli çerçevede kaldı.']],
    },
    manset: {
      standalone: st('Dikkatli ton öne çıktı.', 'Hassas konu sinyali belirdi.'),
      governance: gov('Hassas sinyal dikkat çekti.'),
    },
  },

  safe_balance: {
    user: {
      standalone: st(
        'Bugün bazı sorular dikkat gerektirse de akış dengeli kaldı.',
        'Girişlerde kısa süreli hassas sinyaller vardı.',
        'Bazı konular güvenli çerçeve gerektirdi.',
        'Bugünkü konuşmaların bazı noktalarında dikkatli ilerleme ihtiyacı oluştu.',
        'Bazı sorular sınırları netleştiren cevaplar gerektirdi.',
        'Konuşma yer yer hassaslaştı ama akış kopmadı.',
        'Ölçülü bir soru tonu bugün ara sıra öne çıktı.',
        'Hassas anlar vardı, genel ritim dengeli seyretti.'
      ),
      governance: gov('Hassas konu sinyali gözlemlendi.', 'Dikkat gerektiren girdi alanı açıldı.'),
    },
    ai: {
      standalone: st(
        'AI yanıtları hassas sinyallere rağmen dengeyi korudu.',
        'Yanıtlar güvenli sınırlar içinde kaldı.',
        'AI temkinli ama açıklayıcı bir ton kullandı.',
        'Yanıtlar reddetmekten çok güvenli çerçeve kurmaya çalıştı.',
        'AI ölçülü sınırlar içinde yanıt verdi.',
        'Yanıt tonu güvenli çizgiyi koruyarak ilerledi.'
      ),
      governance: gov('Yanıtlar güvenli sınırlarda kaldı.', 'Temkinli yanıt tonu gözlemlendi.'),
    },
    balance: {
      standalone: st(
        'Hassas sinyale rağmen etkileşim dengesi korundu.',
        'Riskli girişe rağmen yanıt dengesi bozulmadı.',
        'AI sınır koydu ama konuşmayı koparmadı.',
        'Denge, güvenli sınırlarla birlikte sürdü.',
        'Güvenli çerçeve korundu, akış devam etti.',
        'Hassas anlara rağmen konuşma dengeli kaldı.'
      ),
      governance: gov('Hassas sinyale rağmen denge korundu.', 'Riskli girişe rağmen denge stabil.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün denge korundu.',
        'Hassas sinyale rağmen yanıt güvenli kaldı.',
        'Konuşma güvenli sınırlar içinde sürdü.',
        'Ölçülü ton bugün öne çıkıyordu.'
      ),
      governance: gov('Güvenli denge sinyali görüldü.', 'Denge korunarak ilerlendi.'),
    },
    whyBulletSets: {
      standalone: [
        ['Bazı girişler dikkat gerektirdi.', 'Yanıtlar güvenli çerçeveyi koruyarak ilerledi.'],
        ['Hassas sinyal kısa süreli belirdi.', 'Etkileşim dengesi korundu.'],
        ['Güvenli sınır ihtiyacı vardı.', 'Yanıt tonu ölçülü kaldı.'],
      ],
      governance: [['Dikkat gerektiren girdi.', 'Güvenli yanıt çerçevesi kullanıldı.']],
    },
    manset: {
      standalone: st('Güvenli denge öne çıktı.', 'Ölçülü ton belirdi.'),
      governance: gov('Güvenli denge.'),
    },
  },

  flow_harmony: {
    user: {
      standalone: st(
        'Bugünkü konuşmalarda akış oldukça doğal ilerledi.',
        'Yanıtlarla uyumun bugün daha yüksek görünüyordu.',
        'Bugün konuşma daha az kırılmayla devam etti.',
        'Sorular ve yanıtlar arasında güçlü bir akış oluştu.',
        'Bugünkü etkileşimler daha rahat ilerledi.',
        'Konuşma ritmi bugün daha tutarlıydı.',
        'Akış bugün soru–yanıt uyumuyla belirgindi.',
        'Etkileşimler arasında doğal bir ritim vardı.'
      ),
      governance: gov('Akış uyumu yüksek seyretti.', 'Soru–yanıt uyumu belirginleşti.'),
    },
    ai: {
      standalone: st(
        'Yanıtlar soru yapınla yüksek uyum gösterdi.',
        'AI konuşma ritmine iyi eşlik etti.',
        'Yanıt tonu akışı destekleyen bir çizgideydi.',
        'AI cevapları konuşmanın yönünü bozmadı.',
        'Yanıtlar bağlamla uyumlu kaldı.',
        'AI akışı destekleyen bir yanıt yapısı kullandı.'
      ),
      governance: gov('Yanıtlar yüksek uyum gösterdi.', 'Çıktılar akışı destekledi.'),
    },
    balance: {
      standalone: st(
        'Etkileşim tonu stabil ve dengeli kaldı.',
        'Akış uyumu güçlüydü, denge korundu.',
        'Konuşma ritmi doğal şekilde sürdü.',
        'Uyum yüksek seyretti, yönlendirme baskısı oluşmadı.',
        'Akış rahattı, denge bozulmadı.',
        'Uyum sinyali güçlü kaldı, ton sakin seyretti.'
      ),
      governance: gov('Etkileşim dengesi stabil kaldı.', 'Akış uyumu korundu.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün akış uyumu yüksekti.',
        'Konuşma ritmi dengeli seyretti.',
        'Bugünkü etkileşim rahat ilerledi.',
        'Akış bugün öne çıkıyordu.'
      ),
      governance: gov('Akış uyumu yüksek seyretti.', 'Ritim dengeli.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sorular ve yanıtlar birbirini doğal şekilde tamamladı.', 'AI yanıtları konuşma ritmine uyum sağladı.'],
        ['Akış uyumu belirgindi.', 'Etkileşim dengesi korundu.'],
        ['Soru yapısı ve yanıt tonu uyumluydu.', 'Yönlendirme baskısı oluşmadı.'],
      ],
      governance: [['Yüksek uyum sinyali.', 'Ritim dengeli kaldı.']],
    },
    manset: {
      standalone: st('Akış uyumu belirdi.', 'Uyumlu akış öne çıktı.'),
      governance: gov('Akış uyumu.'),
    },
  },

  creative_ideas: {
    user: {
      standalone: st(
        'Bugünkü konuşmalar daha çok fikir geliştirme yönünde ilerledi.',
        'Bugün yeni ihtimaller üretmeye odaklı bir akış vardı.',
        'Bazı sorularında tasarlama ve kurgulama isteği öne çıktı.',
        'Bugünkü etkileşimlerde fikirleri büyütme eğilimi belirgindi.',
        'Konuşma yeni seçenekler üretmeye yakın ilerledi.',
        'Bugün “nasıl daha iyi olur?” sorusu daha baskındı.',
        'Fikir geliştirme tonu bugün belirgindi.',
        'Yaratıcı taslak arayışı konuşmaya yansıdı.'
      ),
      governance: gov('Fikir geliştirme sinyali gözlemlendi.', 'Tasarım odaklı girdi belirginleşti.'),
    },
    ai: {
      standalone: st(
        'AI yeni ihtimaller ve açılımlar üretmeye çalıştı.',
        'Yanıtlar fikirleri genişleten bir yapı taşıyordu.',
        'AI öneri alanını büyütmeye daha yatkın görünüyordu.',
        'Yanıtlar taslakları geliştirme yönünde ilerledi.',
        'AI fikir alanını genişleten cevaplar verdi.',
        'Yanıt tonu yeni seçenekler üretmeye yöneldi.'
      ),
      governance: gov('Yanıtlar fikir genişletme içerdi.', 'Çıktılar taslak geliştirdi.'),
    },
    balance: {
      standalone: st(
        'Konuşma yaratıcı ama dengeli bir çizgide kaldı.',
        'Fikir üretimi öne çıktı, akış kontrolünü kaybetmedi.',
        'Yeni ihtimaller açıldı ama konuşma dağılmadı.',
        'Yaratıcı akış güçlüydü, denge korunmuş görünüyordu.',
        'Fikir geliştirme belirgindi, ton sakin kaldı.',
        'Yaratıcı ton vardı, etkileşim dengesi korundu.'
      ),
      governance: gov('Yaratıcı ton dengeli kaldı.', 'Denge korundu.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün fikir geliştirme öne çıktı.',
        'Yaratıcı akış daha belirgindi.',
        'Konuşmalar yeni ihtimaller etrafında şekillendi.',
        'Tasarlama odağı bugün öne çıkıyordu.'
      ),
      governance: gov('Fikir geliştirme odaklı etkileşim.', 'Yaratıcı ton belirginleşti.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sorular yeni alternatifler üretmeye yöneldi.', 'Yanıtlar fikirleri genişleten bir yapı kullandı.'],
        ['Fikir geliştirme sinyali vardı.', 'Akış dağılmadan sürdü.'],
        ['Tasarım odağı belirgindi.', 'Etkileşim dengesi korundu.'],
      ],
      governance: [['Fikir genişletme sinyali.', 'Dengeli yanıt yapısı.']],
    },
    manset: {
      standalone: st('Fikir geliştirme öne çıktı.', 'Yaratıcı akış belirdi.'),
      governance: gov('Fikir geliştirme.'),
    },
  },

  balanced: {
    user: {
      standalone: st(
        'Bugünkü konuşmalar genel akışınla uyumlu görünüyordu.',
        'Bugün belirgin bir sinyal sapması gözlemlenmedi.',
        'Konuşmalar sakin ve dengeli bir ritimde ilerledi.',
        'Bugünkü soru yapısı genel profilinle uyumlu seyretti.',
        'Etkileşimlerde öne çıkan sert bir kırılma görünmedi.',
        'Bugün konuşma tonu genel olarak stabil kaldı.',
        'Son konuşmalarda dengeli bir düşünme akışı öne çıktı.',
        'Bugünkü etkileşimler sakin ve ölçülü bir çizgide kaldı.'
      ),
      governance: gov('Denge stabil göründü.', 'Genel profille uyumlu seyretti.'),
    },
    ai: {
      standalone: st(
        'Yanıt tonu dengeli ve nötr kaldı.',
        'AI cevapları sakin bir çizgide ilerledi.',
        'Yanıtlar aşırı yönlendirici bir ton taşımadı.',
        'AI konuşmanın ritmini dengede tuttu.',
        'Yanıtlar ölçülü ve dengeli kaldı.',
        'AI nötr ama destekleyici bir ton kullandı.'
      ),
      governance: gov('Yanıtlar nötr ve dengeli kaldı.', 'Çıktılar sakin çizgide.'),
    },
    balance: {
      standalone: st(
        'Belirgin bir sapma gözlemlenmedi.',
        'Etkileşim dengesi genel çizgisini korudu.',
        'Konuşma sakin ve stabil bir akışta kaldı.',
        'Bugünkü etkileşim tonu dengeli seyretti.',
        'Konuşma dengesi stabil kaldı.',
        'Genel akış ölçülü ve tutarlıydı.'
      ),
      governance: gov('Etkileşim dengesi stabil kaldı.', 'Sapma gözlemlenmedi.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün dengeli bir akış vardı.',
        'Belirgin bir sapma görünmedi.',
        'Konuşma tonu stabil kaldı.',
        'Son konuşmalarda dengeli ve sakin bir düşünme akışı öne çıkıyordu.',
        'Konuşmaların genel çizgisi ölçülü ve dengeli ilerledi.'
      ),
      governance: gov('Denge stabil görünüyor.', 'Dengeli etkileşim akışı.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sinyaller genel çizgiyle uyumlu seyretti.', 'Yanıtlar dengeli ve nötr bir yapı taşıdı.'],
        ['Belirgin sapma oluşmadı.', 'Etkileşim dengesi korundu.'],
        ['Soru yapısı sakin ilerledi.', 'Yanıt tonu ölçülü kaldı.'],
      ],
      governance: [['Genel çizgiyle uyum.', 'Nötr yanıt yapısı.']],
    },
    manset: {
      standalone: st('Dengeli bir akış.', 'Sakin bir düşünme çizgisi.', 'Denge korundu.'),
      governance: gov('Denge korundu.', 'Dengeli oturum.'),
    },
  },

  intellectual_depth: {
    user: {
      standalone: st(
        'Bugünkü sorular daha fazla düşünsel yoğunluk taşıyordu.',
        'Bazı konularda daha derin değerlendirme arayışı vardı.',
        'Konuşmalar yüzeyden çok neden-sonuç ilişkilerine yöneldi.',
        'Bugün cevaplardan çok arka planı anlamaya çalışıyor gibiydin.',
        'Bazı soruların daha katmanlı bir düşünme akışı taşıdı.',
        'Bugünkü konuşmalarda ayrıntı arayışı daha belirgindi.',
        'Derinleşme isteği bugün soru yapısında öne çıktı.',
        'Katmanlı düşünme akışı bugün dikkat çekiyordu.'
      ),
      governance: gov('Düşünsel yoğunluk sinyali gözlemlendi.', 'Derin değerlendirme arayışı.'),
    },
    ai: {
      standalone: st(
        'AI daha açıklayıcı ve katmanlı yanıtlar vermeye çalıştı.',
        'Yanıtlar konunun arka planını açmaya yöneldi.',
        'AI daha fazla gerekçe sunan bir yapı kullandı.',
        'Yanıtlar yüzeysel kalmadan açıklama üretmeye çalıştı.',
        'AI katmanlı açıklama üretmeye yöneldi.',
        'Yanıt tonu arka planı açan bir çizgideydi.'
      ),
      governance: gov('Yanıtlar katmanlı açıklama içerdi.', 'Gerekçe yoğunluğu arttı.'),
    },
    balance: {
      standalone: st(
        'Düşünsel yoğunluk arttı ama konuşma dengesi korundu.',
        'Daha derin açıklamalar konuşma akışını bozmadı.',
        'Katmanlı akışa rağmen denge stabil kaldı.',
        'Ayrıntı ihtiyacı belirgindi, yanıtlar bunu taşıyabildi.',
        'Derinlik arttı, akış kontrollü kaldı.',
        'Yoğunluk belirgindi, etkileşim dengesi korundu.'
      ),
      governance: gov('Yoğunluk arttı, denge korundu.', 'Katmanlı akış dengeli.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün düşünsel yoğunluk arttı.',
        'Konuşmalar daha katmanlı ilerledi.',
        'Bugün arka planı anlama isteği öne çıktı.',
        'Derinleşme bugün belirgindi.'
      ),
      governance: gov('Düşünsel yoğunluk belirginleşti.', 'Katmanlı etkileşim.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sorular daha fazla gerekçe ve bağlam aradı.', 'Yanıtlar daha katmanlı açıklamalarla ilerledi.'],
        ['Derinleşme sinyali vardı.', 'Etkileşim dengesi korundu.'],
        ['Katmanlı soru yapısı belirgindi.', 'Yanıt tonu arka plan açtı.'],
      ],
      governance: [['Bağlam arayışı.', 'Katmanlı yanıt yapısı.']],
    },
    manset: {
      standalone: st('Düşünsel yoğunluk belirdi.', 'Katmanlı akış öne çıktı.'),
      governance: gov('Yoğunluk sinyali.'),
    },
  },

  explanation_seek: {
    user: {
      standalone: st(
        'Bugün daha fazla açıklama ihtiyacı öne çıktı.',
        'Bazı sorularda “neden?” tarafı daha belirgindi.',
        'Bugünkü konuşmalarda gerekçe arayışı dikkat çekti.',
        'Cevapların arkasındaki mantığı görmek istiyor gibiydin.',
        'Bugün yalnızca sonuç değil, açıklama da aradın.',
        'Soru yapın daha fazla bağlam istemeye yöneldi.',
        'Gerekçe ihtiyacı bugün belirgindi.',
        'Açıklama arayışı konuşma tonuna yansıdı.'
      ),
      governance: gov('Açıklama arayışı gözlemlendi.', 'Gerekçe sinyali belirginleşti.'),
    },
    ai: {
      standalone: st(
        'AI yanıtları gerekçelendirme tarafını güçlendirdi.',
        'Yanıtlar açıklama ve bağlam üretmeye daha yatkındı.',
        'AI daha fazla neden-sonuç ilişkisi kurmaya çalıştı.',
        'Yanıtlar kısa cevap yerine açıklama ağırlıklı ilerledi.',
        'AI bağlam sunan bir yapı kullandı.',
        'Yanıt tonu gerekçelendirmeye yöneldi.'
      ),
      governance: gov('Yanıtlar gerekçe yoğunluğu taşıdı.', 'Açıklama ağırlıklı çıktı.'),
    },
    balance: {
      standalone: st(
        'Açıklama arayışı konuşmayı daha anlaşılır hale getirdi.',
        'Gerekçe ihtiyacı vardı, akış yine dengeli kaldı.',
        'Yanıtlar açıklayıcı oldu ama yönlendirme baskısı oluşmadı.',
        'Konuşma daha açıklamalı ama kontrollü ilerledi.',
        'Açıklama ihtiyacı karşılandı, denge korundu.',
        'Gerekçe arayışı belirgindi, ton sakin kaldı.'
      ),
      governance: gov('Açıklama arayışı dengeli seyretti.', 'Denge korundu.'),
    },
    primaryInsight: {
      standalone: st(
        'Bugün açıklama arayışı öne çıktı.',
        'Cevapların arka planı bugün daha önemliydi.',
        'Bugünkü konuşmalar daha açıklama odaklıydı.',
        'Gerekçe arayışı bugün belirgindi.'
      ),
      governance: gov('Açıklama arayışı öne çıktı.', 'Gerekçe odağı.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sorular sonuçtan çok gerekçe aradı.', 'Yanıtlar bağlam ve açıklama üretmeye yöneldi.'],
        ['“Neden?” tarafı belirgindi.', 'Yanıt tonu gerekçelendirici kaldı.'],
        ['Açıklama ihtiyacı vardı.', 'Etkileşim dengesi korundu.'],
      ],
      governance: [['Gerekçe arayışı.', 'Bağlamlı yanıt yapısı.']],
    },
    manset: {
      standalone: st('Açıklama arayışı öne çıktı.', 'Gerekçe sinyali belirdi.'),
      governance: gov('Açıklama odağı.'),
    },
  },

  question_clarity: {
    user: {
      standalone: st(
        'Bugünkü sorular daha doğrudan ve net bir yapı taşıyordu.',
        'Son konuşmalarda soru netliği sinyali belirgindi.',
        'Soru yapın hedefe odaklı ilerledi.',
        'Bugün sorular daha açık bir çerçeve kullandı.',
        'Net soru tonu bugün öne çıktı.',
        'Doğrudan soru yapısı dikkat çekiyordu.'
      ),
      governance: gov('Soru netliği odaklı ton.', 'Doğrudan soru yapısı.'),
    },
    ai: {
      standalone: st(
        'Yanıtlar soru netliğine uyumlu kaldı.',
        'AI doğrudan ve hedefe dönük yanıtlar verdi.',
        'Yanıt yapısı soru çerçevesine uydu.',
        'AI net soru yapısını destekleyen bir ton kullandı.'
      ),
      governance: gov('Yanıtlar soru netliğiyle uyumlu.', 'Hedefe dönük çıktı.'),
    },
    balance: {
      standalone: st(
        'Soru netliği belirgindi, denge korundu.',
        'Hedef odaklı akış sürdü.',
        'Net soru yapısı akışı dağıtmadı.',
        'Doğrudan ton vardı, etkileşim dengesi stabil kaldı.'
      ),
      governance: gov('Netlik dengeli seyretti.', 'Denge korundu.'),
    },
    primaryInsight: {
      standalone: st(
        'Soruların bugün daha net ve hedef odaklı bir yapı taşıyordu.',
        'Doğrudan netlik arayışı öne çıkıyordu.',
        'Soru netliği bugün belirgindi.'
      ),
      governance: gov('Soru netliği odaklı ton.', 'Net soru yapısı.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sorular doğrudan kuruldu.', 'Yanıtlar hedefe uyumlu ilerledi.'],
        ['Soru netliği belirgindi.', 'Etkileşim dengesi korundu.'],
      ],
      governance: [['Net soru yapısı.', 'Uyumlu yanıt tonu.']],
    },
    manset: {
      standalone: st('Net soru yapısı belirdi.', 'Açık soru tonu öne çıktı.'),
      governance: gov('Soru netliği.'),
    },
  },

  quiet: {
    user: {
      standalone: st(
        'Bugünkü konuşmalar genel akışınla uyumlu görünüyordu.',
        'Belirgin bir sapma gözlemlenmedi.',
        'Konuşmalar hafif ve sakin bir ritimde ilerledi.',
        'Bugün belirgin bir ton kırılması görünmedi.',
        'Etkileşimler ölçülü ve sessiz bir çizgide kaldı.',
        'Bugün konuşma tonu hafif ve stabil kaldı.'
      ),
      governance: gov(
        'Belirgin kullanıcı sinyali sapması gözlemlenmedi.',
        'Sakin ve dengeli çizgi.'
      ),
    },
    ai: {
      standalone: st(
        'Yanıt tonu sakin ve dengeli kaldı.',
        'AI ölçülü bir yanıt çizgisi kullandı.',
        'Yanıtlar hafif ve nötr seyretti.',
        'AI konuşmayı sakin ritimde tuttu.'
      ),
      governance: gov('Nötr yanıt tonu.', 'Sakin çıktı çizgisi.'),
    },
    balance: {
      standalone: st(
        'Belirgin bir sapma gözlemlenmedi.',
        'Etkileşim dengesi sakin kaldı.',
        'Konuşma hafif ve stabil seyretti.',
        'Genel ton ölçülüydü.'
      ),
      governance: gov('Denge stabil kaldı.', 'Sapma yok.'),
    },
    primaryInsight: {
      standalone: st(
        'Sakin ve dengeli bir konuşma çizgisi sürdü.',
        'Belirgin bir ton sapması oluşmadı.',
        'Hafif ve stabil bir akış vardı.'
      ),
      governance: gov('Sakin etkileşim akışı.', 'Stabil ton.'),
    },
    whyBulletSets: {
      standalone: [
        ['Sinyaller hafif seyretti.', 'Yanıtlar sakin ve nötr kaldı.'],
        ['Belirgin sapma yoktu.', 'Etkileşim dengesi korundu.'],
      ],
      governance: [['Düşük sinyal yoğunluğu.', 'Nötr yanıt tonu.']],
    },
    manset: {
      standalone: st('Sakin bir konuşma akışı.', 'Hafif ton.'),
      governance: gov('Sakin akış.'),
    },
  },
};
