/**

 * SAINA Conversation Mirror — static mock copy (Sprint A / A.5).

 */



export const SAINA_BRAND = 'SAINA';

export const SAINA_TAGLINE = 'Your Human-AI reflection';

export const SAINA_POWERED = 'Powered by EZA';



export const SAINA_CONVERSATIONS_TITLE = 'Sohbetlerim';

export const SAINA_NEW_CHAT = 'Yeni sohbet';

export const SAINA_CONV_MENU_LABEL = 'Sohbet seçenekleri';

export const SAINA_CONV_RENAME = 'Yeniden adlandır';

export const SAINA_CONV_DELETE = 'Sil';

export const SAINA_TOP_SEARCH_PLACEHOLDER = 'Bir şey ara...';

export const SAINA_COMMAND_DIALOG_LABEL = 'Komut paleti';

export const SAINA_COMMAND_SEARCH_PLACEHOLDER = 'Sohbetlerde ara…';

export const SAINA_COMMAND_QUICK_ACTIONS = 'Hızlı aksiyonlar';

export const SAINA_COMMAND_ACTION_NEW_CHAT = 'Yeni sohbet';

export const SAINA_COMMAND_ACTION_OPEN_MIRROR = 'Ayna panelini aç';

export const SAINA_COMMAND_ACTION_PATTERN = 'İlişki Deseni';

export const SAINA_COMMAND_RECENT_CHATS = 'Sohbetler';

export const SAINA_COMMAND_NO_RESULTS = 'Sonuç bulunamadı.';

export const SAINA_NOTIFICATIONS_TITLE = 'Bildirimler';

export const SAINA_NOTIFICATIONS_EMPTY = 'Henüz yeni bildirim yok.';

export const SAINA_NOTIFICATIONS_EMPTY_NOTE =
  'Ayna hazır olduğunda ve sohbet bildirimi oluştuğunda burada görünecek.';



export const SAINA_MIRROR_TITLE = 'Ayna';

export const SAINA_MIRROR_SUBTITLE = 'Bu sohbetten doğan anlamı aynada görün.';



export const SAINA_EMPTY_TEASER_TITLE = 'Bu sohbetin izi belirginleşiyor.';

export const SAINA_EMPTY_TEASER_BODY =

  'İzler derinleştikçe, senin için özel bir ayna oluşturabiliriz.';



export const SAINA_EMPTY_TITLE = 'Bu sohbet için henüz ayna oluşturulmadı.';

export const SAINA_EMPTY_BODY =

  'Konuşmanın desenlerini, fikirlerini ve içgörülerini senin için bir araya getirebilirim.';

/** User intent — visualize conversation; system names outcome Ayna or Yansı. */
export const SAINA_CREATE_VISUAL = 'Görseli Oluştur';

/** @deprecated Use SAINA_CREATE_VISUAL */
export const SAINA_CREATE_MIRROR = SAINA_CREATE_VISUAL;



export const SAINA_MIRROR_HOW_LABEL = 'AYNA NASIL ÇALIŞIR?';



export const SAINA_CHECKLIST = [

  'Sohbet analiz edilir',

  'Ana tema çıkarılır',

  'Desenler belirlenir',

  'Ayna kartı hazırlanır',

] as const;



/** Default generating copy — prefer resolveMirrorPanelCopy() per chat context. */
export const SAINA_GENERATING = 'Aynan hazırlanıyor…';

/** Default ready copy — prefer resolveMirrorPanelCopy() per chat context. */
export const SAINA_READY_TITLE = 'Aynan hazır.';

export const SAINA_READY_POSTER_TITLE = 'İpek Yolu Sohbeti';

export const SAINA_READY_POSTER_INSIGHT =

  'Keşif, tarih ve bağ kurma temaları bugünkü yansımanda öne çıkıyor.';

export const SAINA_OPEN_PREVIEW = 'Önizlemeyi Aç';

export const SAINA_SHARE = 'Paylaş';

export const SAINA_DOWNLOAD = 'İndir';

export const SAINA_REGENERATE = 'Yeniden Oluştur';



export const SAINA_FREE_TITLE = 'SAINA Free';

export const SAINA_GUEST_TITLE = 'SAINA Guest';

/** Sidebar footer — logged-in free user. */
export const SAINA_SIDEBAR_FREE_FOOTER = `${SAINA_FREE_TITLE} · Premium'a Geç →`;

/** Sidebar footer — guest / anonymous user. */
export const SAINA_SIDEBAR_GUEST_FOOTER = `${SAINA_GUEST_TITLE} · Giriş Yap →`;

export const SAINA_PREMIUM_TITLE = 'SAINA Premium ✦';

export const SAINA_PREMIUM_ACTIVE_LABEL = 'SAINA Premium Aktif ✦';

export const SAINA_PLAN_ACTIVE = 'Aktif';

export const SAINA_PLAN_LOADING_BODY = 'Plan bilgisi kontrol ediliyor...';

export const SAINA_PLAN_SESSION_INVALID_BODY = 'Oturum doğrulanamadı';

export const SAINA_PLAN_SESSION_INVALID_NOTE =
  'Tekrar giriş yaparak Premium deneyimini aç.';

export const SAINA_PLAN_LOGIN_CTA = 'Giriş yap';

/** @deprecated Use SAINA_PLAN_SESSION_INVALID_BODY */
export const SAINA_PLAN_UNKNOWN_BODY = SAINA_PLAN_SESSION_INVALID_BODY;

/** @deprecated Use SAINA_PLAN_LOGIN_CTA */
export const SAINA_PLAN_CHECK_ACCOUNT = SAINA_PLAN_LOGIN_CTA;

export const SAINA_ANON_FREE_BODY = 'Temel sohbet deneyimi açık.';

export const SAINA_ANON_FREE_CTA = 'Şimdi Premium Ol';

export const SAINA_ANON_FREE_NOTE =
  'Sohbet etmek için giriş gerekmez. Ayna kaydetmek veya İlişki Deseni için giriş yapabilirsin.';

export const SAINA_LOGGEDIN_FREE_BODY = 'Hesabın hazır.';

export const SAINA_LOGGEDIN_FREE_CTA = "Premium'a Geç";

export const SAINA_LOGGEDIN_FREE_NOTE =
  "Ayna ve İlişki Deseni Premium'da aktif.";

/** @deprecated Use SAINA_ANON_FREE_BODY */
export const SAINA_FREE_BODY = SAINA_ANON_FREE_BODY;

/** @deprecated Use SAINA_ANON_FREE_CTA */
export const SAINA_FREE_CTA = SAINA_ANON_FREE_CTA;

/** @deprecated Use SAINA_ANON_FREE_NOTE */
export const SAINA_FREE_NOTE = SAINA_ANON_FREE_NOTE;

export const SAINA_PREMIUM_OBSERVING = 'Şu an ilişki gözlemleniyor...';

export const SAINA_PREMIUM_MIRROR_LABEL = 'Ayna';

export const SAINA_PREMIUM_PATTERN_LABEL = 'İlişki Haritası';

export const SAINA_PREMIUM_LIVE_STATUS = 'Canlı';

/** @deprecated Use SAINA_PREMIUM_OBSERVING */
export const SAINA_PREMIUM_BODY = SAINA_PREMIUM_OBSERVING;

/** @deprecated Use SAINA_PREMIUM_MIRROR_LABEL */
export const SAINA_PREMIUM_MIRROR_ACTIVE = SAINA_PREMIUM_MIRROR_LABEL;

/** @deprecated Use SAINA_PREMIUM_PATTERN_LABEL */
export const SAINA_PREMIUM_PATTERN_ACTIVE = SAINA_PREMIUM_PATTERN_LABEL;

/** @deprecated Use SAINA_PREMIUM_MIRROR_ACTIVE */
export const SAINA_PREMIUM_STATUS = 'Premium deneyim açık';

/** @deprecated Use SAINA_PLAN_ACTIVE */
export const SAINA_PREMIUM_ACTIVE = SAINA_PLAN_ACTIVE;

export const SAINA_PREMIUM_BODY_SHORT = 'Ayna haklarınız aktif.';



export const SAINA_RELATIONSHIP_PATTERN_TITLE = 'İlişki Haritası';

export const SAINA_RELATIONSHIP_PATTERN_BODY = 'Uzun dönem ilişki haritanı gör.';

export const SAINA_RELATIONSHIP_PATTERN_CTA = 'Aç →';



export const SAINA_CHIPS_TOGGLE = 'Öneriler →';



export const SAINA_MIRROR_COLLAPSE_LABEL = 'Ayna panelini gizle';

export const SAINA_MIRROR_EXPAND_LABEL = 'Ayna panelini aç';

export const SAINA_MIRROR_EXPAND_TAB = 'Ayna';

export const SAINA_MIRROR_READY_BADGE = 'Hazır';

export const SAINA_MOBILE_MIRROR_CTA_EMPTY =
  '✦ Ayna — sohbet ettikçe yansıman oluşur';

export const SAINA_MOBILE_MIRROR_CTA_AFTER_RESPONSE =
  '✦ Ayna — sohbetini yansıt';

export const SAINA_MOBILE_MIRROR_CTA_SIGNAL_READY =
  '✦ Ayna hazır — ilişkinin ilk izi oluştu';

/** Production /standalone placeholder — mirror generate not wired in B.1 */
export const SAINA_STANDALONE_MIRROR_PLACEHOLDER_TITLE =
  'Bu sohbetin aynası burada görünecek';

export const SAINA_STANDALONE_MIRROR_PLACEHOLDER_BODY =
  'Sohbet ilerledikçe Ayna bu alanda hazır olacak. Şimdilik sohbet akışına odaklanabilirsin.';

export const SAINA_UPSELL_TITLE = 'SAINA Premium ile';

export const SAINA_UPSELL_BODY = 'Her sohbetin aynasını oluşturabilirsin.';

export const SAINA_UPSELL_CTA = "Premium'u Keşfet";



export const SAINA_HERO_PILL = 'Aktif Sohbet';

export const SAINA_HERO_DEFAULT_TITLE = 'Yeni Sohbet';

export const SAINA_HERO_DEFAULT_SUBTITLE = 'SAINA ile düşün, keşfet ve anlamlandır.';

export const SAINA_HERO_META_START = 'Başlangıç: Az önce';

export const SAINA_HERO_META_DURATION = 'Süre: 0 dk';



export const SAINA_HERO_SUBTITLE =

  'İpek Yolu üzerine yaptığımız bu konuşma, farklı perspektifleri bir araya getiriyor.';



export const SAINA_COMPOSER_PLACEHOLDER = "SAINA'ya bir şey sor...";

export const SAINA_USER_LABEL = 'SEN';

export const SAINA_ASSISTANT_LABEL = 'SAINA';

export const SAINA_MENU_ACCOUNT = 'Hesap';

export const SAINA_MENU_SETTINGS = 'Ayarlar';

export const SAINA_MENU_COMING_SOON = 'Yakında';

export const SAINA_MENU_GUEST_LABEL = 'Misafir';

export const SAINA_MENU_GUEST_SAVE_CHATS = 'Sohbetlerini kaydet';

export const SAINA_MENU_GUEST_SYNC_MIRRORS = 'Yansıları senkronize et';

export const SAINA_MENU_GUEST_MULTI_DEVICE = 'Tüm cihazlarında devam et';

export const SAINA_MENU_LOGIN = 'Giriş Yap';

export const SAINA_MENU_REGISTER = 'Hesap Oluştur';

export const SAINA_MENU_LOGOUT = 'Çıkış';

/** Identity modal — guest save / sign-in (no Premium language). */
export const SAINA_IDENTITY_MODAL_LINES = [
  'Sohbetlerini kaydet.',
  'Aynalarını sakla.',
  'Yansılarına her cihazdan ulaş.',
] as const;

export const SAINA_IDENTITY_MODAL_LOGIN = 'Giriş Yap';

export const SAINA_IDENTITY_MODAL_REGISTER = 'Hesap Oluştur';

export const SAINA_IDENTITY_MODAL_DISMISS = 'Şimdilik devam et';

/** Premium upgrade modal — logged-in free users only. */
export const SAINA_PREMIUM_MODAL_TITLE = 'SAINA Premium';

export const SAINA_PREMIUM_MODAL_FEATURES = [
  'Limitsiz Ayna',
  'Limitsiz Yansı',
  'Geçmiş Aynalar',
  'Premium kalite',
  'Yeni sezonlar',
  'Öncelikli üretim',
] as const;

export const SAINA_PREMIUM_MODAL_CTA = "Premium'a Geç";

export const SAINA_PREMIUM_MODAL_DISMISS = 'Şimdilik kapat';

export const SAINA_PREMIUM_MODAL_NOTE =
  'Ödeme sistemi yakında. Şimdilik bu, Premium deneyiminin bir önizlemesidir.';

/** SAINA auth pages (standalone return). */
export const SAINA_AUTH_LOGIN_TITLE = 'Sohbetlerin seni bekliyor.';

export const SAINA_AUTH_REGISTER_TITLE = 'Yeni bir merak yolculuğu başlat.';

export const SAINA_AUTH_GOOGLE_CTA = 'Google ile devam et';

export const SAINA_AUTH_OR_DIVIDER = 'veya';

export const SAINA_AUTH_EMAIL_LABEL = 'E-posta';

export const SAINA_AUTH_PASSWORD_LABEL = 'Şifre';

export const SAINA_AUTH_NAME_LABEL = 'Ad';

export const SAINA_AUTH_LOGIN_SUBMIT = 'Devam Et';

export const SAINA_AUTH_REGISTER_SUBMIT = 'Hesap Oluştur';

export const SAINA_AUTH_NO_ACCOUNT = 'Hesabın yok mu?';

export const SAINA_AUTH_HAS_ACCOUNT = 'Zaten hesabın var mı?';

export const SAINA_AUTH_GOOGLE_UNAVAILABLE =
  'Google ile giriş yakında aktif olacak. Şimdilik e-posta ile devam edebilirsin.';

export const SAINA_SAFE_MODE_LABEL = 'Güvenli Mod';

export const SAINA_SAFE_MODE_NOTE = 'Yanıtlar güvenli ve uyumlu olacak şekilde yeniden yazılır.';

export const SAINA_ANALYSIS_MODEL_LABEL = 'Analiz Modeli';



export const SAINA_QUICK_CHIPS = [

  'Bu sohbetin ana teması ne?',

  'Farklı perspektifleri özetler misin?',

  'Bu konuşmadan ne öğrendim?',

  'Başka ne keşfedebiliriz?',

] as const;



export const SAINA_FOOTER =

  'SAINA, insan ile yapay zekâ arasındaki ilişkinin aynasıdır.';



export const SAINA_MODAL_TITLE = 'İpek Yolu Aynası';

export const SAINA_MODAL_MOCK_NOTE = 'Statik önizleme — Sprint A mock';

export const SAINA_DELETE_CHAT_TITLE = 'Bu sohbet silinsin mi?';

export const SAINA_DELETE_CHAT_DESCRIPTION =
  'Bu işlem yalnızca bu cihazdaki sohbet kaydını siler. Paylaşılmış Aynalar etkilenmez.';

export const SAINA_DELETE_CHAT_CANCEL = 'Vazgeç';

export const SAINA_DELETE_CHAT_CONFIRM = 'Sohbeti sil';



export const SAINA_CONCEPT_FEELING_TITLE = 'Bu arka plan nasıl bir his verir?';

export const SAINA_CONCEPT_FEELINGS = [

  'Yolculuk',

  'Açık Ufuk',

  'Sakinlik',

  'İlham',

] as const;

export const SAINA_CONCEPT_NEXT_TITLE = 'Sonra ne olur?';

export const SAINA_CONCEPT_NEXT_BODY =

  'Sohbet ilerleyip ayna oluşturulacak seviyeye geldiğinde özel sahnen üretilecek.';


