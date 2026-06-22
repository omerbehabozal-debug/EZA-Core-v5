/**
 * EZA Mirror — ürün dili ve IA metinleri (Sprint 4).
 */

/** Canonical Mirror surface route (index → redirects to daily) */
export const MIRROR_ROUTE = '/standalone/mirror';

/** Ayna alt görünümleri — deep-link'lenebilir route'lar */
export const MIRROR_DAILY_ROUTE = '/standalone/mirror/daily';
export const MIRROR_PATTERN_ROUTE = '/standalone/mirror/pattern';

export const MIRROR_PAGE_TITLE = 'EZA Mirror';

export const MIRROR_PAGE_SUBTITLE = 'AI ile kurduğun bağın yansıması.';

export const MIRROR_TAB_DAILY = 'AI Ayna';

export const MIRROR_TAB_PATTERN = 'AI İlişki Deseni';

export const MIRROR_NAV_ARIA = 'EZA Mirror sekmeleri';

export const MIRROR_SHARE_LABEL = 'Aynanı Paylaş';

export const MIRROR_SHARE_DOWNLOAD_LABEL = 'Kartı İndir';

/** Kısa gizlilik — tüm Mirror yüzeylerinde */
export const MIRROR_PRIVACY_SHORT =
  'Mesaj içeriği paylaşılmaz. EZA yalnızca davranışsal sinyalleri yansıtır.';

export const MIRROR_DAILY_INTRO =
  'Bugünün AI aynası, yazışmalarındaki davranışsal sinyallerden oluşur.';

export const MIRROR_DAILY_PRIVACY_HINT =
  'Mesaj içeriğin paylaşılmaz; yalnızca yansıman görünür.';

export const MIRROR_INSUFFICIENT =
  'EZA Mirror’ın seni daha doğru yansıtabilmesi için birkaç etkileşime daha ihtiyacı var.';

export const MIRROR_SPARSE_ENERGY_HINT =
  'Birkaç sohbetten sonra enerji ve ritim izleri burada belirecek.';

export const MIRROR_PATTERN_TITLE = 'AI İlişki Deseni';

export const MIRROR_PATTERN_INTRO =
  'Bu alan, AI ile kurduğun ilişkinin zaman içindeki yönünü gözlemler.';

export const MIRROR_PATTERN_BODY =
  'EZA, mesaj içeriklerini değil davranışsal sinyalleri izler. Desenler zamanla netleşir; birkaç etkileşim daha doğru bir harita oluşturur.';

export const MIRROR_PATTERN_INSUFFICIENT =
  'Desenin daha net görünmesi için birkaç etkileşime daha ihtiyaç var.';

export const MIRROR_PATTERN_ISLANDS_HEADING = 'Davranış adaları';

export const MIRROR_PATTERN_ISLANDS_SUB =
  'Konuşma biçiminde öne çıkan gözlemsel alanlar — yargı değil, desen.';

export const MIRROR_PATTERN_EMPTY_TITLE = 'Desen henüz şekillenmedi';

export const MIRROR_PATTERN_EMPTY_BODY =
  'Birkaç sohbetten sonra davranış adaların burada yumuşak bir harita olarak belirecek. Acele etmene gerek yok.';

export const MIRROR_PATTERN_BALANCE_LABEL = 'Genel denge';

export const MIRROR_DETAILS_SUMMARY = 'İsteğe bağlı ayrıntılar';

export const MIRROR_SIDEBAR_LABEL = 'Ayna';

export const MIRROR_SHARE_MODAL_TITLE = 'Aynanı paylaş';

export const MIRROR_SHARE_EXPORT_TEXT =
  'Bugünkü AI ilişki aynama baktım ✨\n\nSeninki ne çıkacak?\n\n#EZAİlişkiAynası';

export const MIRROR_SHARE_EXPORT_TEXT_LONG =
  'Bugünkü AI ilişki aynama baktım ✨\nSeninki ne çıkacak?\n#EZAİlişkiAynası\nMesaj içeriği paylaşılmaz.';

export const MIRROR_SHARE_EXPORT_PRIVACY =
  'Paylaşılan görselde sohbet metni yer almaz. Kartın kimliği ve teması paylaşılır; mesaj içeriği paylaşılmaz.';

/** Günlük Ayna — premium idle (Sprint 11D) */
export const MIRROR_CREATE_TITLE = 'Bugünkü aynan hazır.';

export const MIRROR_CREATE_DESCRIPTION =
  'AI ile kurduğun bugünkü ritmin kısa bir yansımasını aç.';

export const MIRROR_CREATE_BUTTON = 'Bugünün Aynasını Aç';

export const MIRROR_CREATE_PRIVACY_NOTE = 'Mesaj içeriği paylaşılmaz.';

/** Reveal aşaması */
export const MIRROR_REVEAL_MESSAGE = 'Yansıman hazırlanıyor…';

/** Yetersiz veri */
export const MIRROR_INSUFFICIENT_TITLE =
  'Aynanın netleşmesi için birkaç iz daha gerekiyor.';

export const MIRROR_INSUFFICIENT_BODY =
  'Biraz daha sohbet ettikten sonra bugünkü yansıman oluşabilir.';

export const MIRROR_INSUFFICIENT_ACTION = 'Sohbete Dön';

/** Kart üretimi beklenmedik şekilde başarısız */
export const MIRROR_ERROR_TITLE = 'Ayna şu an oluşturulamadı';

export const MIRROR_ERROR_BODY =
  'Geçici bir sorun oluştu. Biraz sonra tekrar deneyebilirsin.';

export const MIRROR_ERROR_RETRY = 'Tekrar Dene';

export const MIRROR_STANDALONE_ROUTE = '/standalone';

/** @deprecated Use MIRROR_EPHEMERAL_FREE / MIRROR_EPHEMERAL_PLUS */
export const MIRROR_EPHEMERAL_NOTE =
  'Bugünkü aynan gece sıfırlanır. Beğendiysen paylaş veya indir.';

/** P4-D — ephemeral daily mirror (plan-specific) */
export const MIRROR_EPHEMERAL_FREE =
  'Bugünkü aynan gece sıfırlanır. Paylaşılabilir poster Plus ile açılır.';

export const MIRROR_EPHEMERAL_PLUS =
  'Bugünkü aynan gece sıfırlanır. Paylaşarak saklayabilirsin.';

export const MIRROR_FREE_SHARE_POSTER_HINT =
  'Paylaşım posteri Plus ile açılır. Bugünkü kartını uygulama içinde görebilirsin.';

export const MIRROR_PATTERN_REDIRECT =
  'Zaman içindeki değişimini AI İlişki Deseni\'nde görebilirsin.';

export const MIRROR_PATTERN_REDIRECT_LINK = 'AI İlişki Deseni';

export const MIRROR_SCENE_GENERATE_BUTTON = 'Sahneyi Oluştur';

export const MIRROR_SCENE_GENERATING = 'Sahne hazırlanıyor…';

/** @deprecated Do not show to users — technical status removed in P4-D */
export const MIRROR_SCENE_READY = 'Sahne hazır';

export const MIRROR_SCENE_RETRY = 'Tekrar dene';

export const MIRROR_SCENE_UNAVAILABLE =
  'Sahne görseli şu an hazırlanamadı. Sayfayı yenile veya biraz sonra tekrar dene.';

export const MIRROR_SCENE_SLOW_HINT =
  'Sahne üretimi 1–2 dakika sürebilir. Lütfen bu ekranda kal.';

export const MIRROR_SCENE_LOGIN_HINT =
  'Tam kart görseli için giriş yapman gerekiyor.';

export const PLUS_MIRROR_QUOTA_EXCEEDED_TITLE = 'Bugünkü üretim hakkın doldu';

export const PLUS_MIRROR_QUOTA_EXCEEDED_BODY =
  'Yarın yeni üretim hakların açılır. Bugünkü kartını paylaşabilir veya indirebilirsin.';

/** Ritüel süreleri (ms) */
export const MIRROR_REVEAL_DURATION_MS = 1600;

export const MIRROR_CARD_ENTER_DURATION_MS = 550;

/* ──────────────────────────────────────────────────────────────────────────
 * Sprint 1 — Free / Plus ürün deneyimi metinleri (yalnızca UX katmanı)
 * ────────────────────────────────────────────────────────────────────────── */

/** Onboarding (idle) — ürünü ilk saniyede anlatan karşılama */
export const MIRROR_ONBOARDING_TITLE = 'Bugün AI ile nasıl bir ilişki kurdun?';

export const MIRROR_ONBOARDING_SUBTITLE =
  'Birkaç dakika sohbet et. İlk aynanı ücretsiz keşfet.';

export const MIRROR_ONBOARDING_PREVIEW_LABEL = 'Aynada ne görünür';

export const MIRROR_ONBOARDING_PREVIEW_BADGE = 'Örnek ayna kartı';

/** @deprecated Slider için onboardingPreviewSlides.ts kullan. */
export const MIRROR_ONBOARDING_PREVIEW_IMAGE = '/mirror/onboarding-preview-recipe.png';

export const MIRROR_ONBOARDING_PREVIEW_LOCKED_HINT = 'Sen · AI · Denge';

/** Mini Mirror (Free) */
export const MINI_MIRROR_PERSONA_PREFIX = 'Bugün Sen';

export const MINI_MIRROR_THEME_LABEL = 'Tema';

export const MINI_MIRROR_ENERGY_LABEL = 'Enerji';

export const MINI_MIRROR_TOMORROW_LABEL = 'Yarının İpucu';

export const MINI_MIRROR_LOCKED_HEADING = 'Tam aynanda seni bekleyenler';

/** Free — günlük hak doldu */
export const FREE_MIRROR_LIMIT_TITLE = 'Bugünkü ücretsiz ayna hakkını kullandın';

export const FREE_MIRROR_LIMIT_BODY =
  'Yarın tekrar ücretsiz ayna oluşturabilirsin. Gün içinde yeni ayna oluşturmak için Plus\'a geç.';

export const FREE_MIRROR_LIMIT_NEXT_LABEL = 'Yarın';

export const FREE_MIRROR_LIMIT_PLUS_HINT =
  'Plus ile gün içinde aynayı güncelle, paylaşım ve ilişki deseni açılır.';

export const FREE_MIRROR_READY_PLUS_HINT =
  'Plus ile gün içinde aynayı güncelle, paylaşım posteri ve ilişki deseni açılır.';

export const MIRROR_CURRENT_BADGE = 'Bugünkü aynan güncel';

export const MIRROR_CURRENT_HINT =
  'Yeni sohbetlerden sonra aynanı güncelleyebilirsin.';

export const MIRROR_UPDATE_SIGNAL_HINT = 'Yeni sohbet sinyalleri algılandı.';

export const FREE_MIRROR_LIMIT_CTA = "Plus'a Geç";

/** Plan gate / upgrade */
export const PLAN_UPGRADE_CTA = "Plus'a Geç";

export const PLAN_UPGRADE_MODAL_TITLE = "Plus'a Geç";

export const PLAN_PLUS_FEATURE_HINT =
  'Gün içi güncelleme, paylaşım ve ilişki deseni Plus ile açılır.';

export const MIRROR_UPDATE_LABEL = 'Aynanı Güncelle';

/** Plus — aynı kart, yeni sahne görseli (buildMirrorState / snapshot yok). */
export const MIRROR_NEW_SCENE_LABEL = '✨ Yeni Sahne Oluştur';

export const MIRROR_NEW_SCENE_HINT =
  'Aynı hikâye; yeni görsel yorum (Style Lens).';

export const MIRROR_SCENE_STYLE_PREFIX = 'Sahne stili:';

export const PLAN_UPGRADE_MODAL_BODY =
  'Plus ile persona görselin, tam hikâyen, paylaşılabilir posterin ve AI ile zaman içindeki ilişki desenin açılır.';

export const PLAN_UPGRADE_MODAL_NOTE =
  'Ödeme sistemi yakında. Şimdilik bu, Plus deneyiminin bir önizlemesidir.';

export const PLAN_UPGRADE_MODAL_DISMISS = 'Şimdilik kapat';

export const PLAN_UPGRADE_LOGIN_CTA = 'Giriş Yap';

export const PLAN_UPGRADE_AUTH_TITLE = 'Giriş yap ve Plus’u keşfet';

export const PLAN_UPGRADE_AUTH_BODY =
  'Sahne üretimi ve tam ayna deneyimi için giriş yapman gerekiyor. Plus ile tüm özellikler açılır.';

export const PLAN_UPGRADE_BADGE = 'Plus';

/** Relationship Pattern (Free upsell) */
export const PATTERN_UPSELL_TITLE = 'AI İlişki Haritası canlı hale gelsin';

export const PATTERN_UPSELL_BODY =
  'Plus ile davranış adaların gerçek sohbetlerinden oluşur; trendler, içgörüler ve zaman içindeki dönüşümün açılır.';

export const PATTERN_UPSELL_CTA = 'Plus seviyesine geç';

/** @deprecated blur gate kaldırıldı — upsell metinleri için PATTERN_UPSELL_* kullan */
export const PATTERN_LOCK_TITLE = 'AI ile zaman içindeki dönüşümünü keşfet';

/** @deprecated blur gate kaldırıldı */
export const PATTERN_LOCK_BODY = 'Plus ile açılır';

