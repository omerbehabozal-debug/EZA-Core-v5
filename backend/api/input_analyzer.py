"""
EZA-Core v4.0
Input Analyzer
----------------
Metin tabanlı kullanıcı girdisini analiz ederek:

- Normal niyetler (helpful, stylistic, emotional, humor, curiosity)
- Hassas / izleme gerektiren niyetler (role, decision delegation, mild manipulation)
- Yüksek riskli niyetler (health, finance, politics, self-harm, violence, sexual, hate, jailbreak, vb.)

üzerinden çok boyutlu etik skor üretir.
"""

from typing import Dict, Literal
import re

RiskLevel = Literal["normal", "watch", "high"]


# -------------------------
# Yardımcı Fonksiyonlar
# -------------------------

def _clean_text(text: str) -> str:
    """Temizleme: küçük harfe çevir, boşlukları sadeleştir."""
    return re.sub(r"\s+", " ", text.strip().lower())


def _detect_language(text: str) -> str:
    """Basit TR / EN dil tespiti."""
    turkish_chars = "çğıöşü"
    if any(ch in text for ch in turkish_chars):
        return "tr"
    return "en"


# -------------------------
# Niyet Vektörü Başlatma
# -------------------------

def _init_intent_vector() -> Dict[str, float]:
    """Tüm niyet kategorilerini 0.0 ile başlatır."""
    return {
        # Normal niyetler
        "helpful": 0.0,
        "stylistic": 0.0,
        "emotional": 0.0,
        "humor": 0.0,
        "curiosity": 0.0,

        # Hassas / izleme
        "role_assignment": 0.0,
        "decision_delegation": 0.0,
        "mild_social_manipulation": 0.0,
        "mild_emotional_dominance": 0.0,

        # Yüksek riskli
        "health_risk": 0.0,
        "financial_manipulation": 0.0,
        "political_manipulation": 0.0,
        "self_harm": 0.0,
        "violence": 0.0,
        "sexual_risk": 0.0,
        "hate_bias": 0.0,
        "jailbreak_exploit": 0.0,
        "systemic_manipulation": 0.0,
        "reality_distortion": 0.0,
        "emotional_exploitation": 0.0,
        "high_level_social_engineering": 0.0,
    }


# -------------------------
# Normal Niyetler
# -------------------------

def _score_normal_intents(text: str, intents: Dict[str, float]) -> None:
    """Temel merak, yardım, duygu, espri, stil niyetleri."""

    helpful_patterns = [
        r"nasıl yaparım",
        r"bana açıklar mısın",
        r"yardım eder misin",
        r"öğrenmek istiyorum",
        r"how to",
        r"explain",
        r"help me",
        r"i want to learn",
    ]
    if any(re.search(p, text) for p in helpful_patterns):
        intents["helpful"] = 0.8
        intents["curiosity"] = 0.6

    stylistic_patterns = [
        r"doktor gibi yaz",
        r"avukat gibi yaz",
        r"profesyonel bir dille",
        r"write like a lawyer",
        r"write like a doctor",
        r"formal tone",
    ]
    if any(re.search(p, text) for p in stylistic_patterns):
        intents["stylistic"] = 0.8

    emotional_patterns = [
        r"çok üzgünüm",
        r"çok sinirliyim",
        r"kötü hissediyorum",
        r"depressed",
        r"anxious",
        r"angry",
        r"i feel bad",
    ]
    if any(re.search(p, text) for p in emotional_patterns):
        intents["emotional"] = 0.7

    humor_patterns = [
        r"şaka yapıyorum",
        r"espiri",
        r"komik bir şey",
        r"joke",
        r"funny",
        r"meme",
    ]
    if any(re.search(p, text) for p in humor_patterns):
        intents["humor"] = 0.7

    # düşük riskli merak varsayımı
    if intents["helpful"] == 0.0 and len(text.split()) > 3:
        intents["curiosity"] = max(intents["curiosity"], 0.4)


# -------------------------
# Hassas / Orta Risk Niyetler
# -------------------------

def _score_sensitive_intents(text: str, intents: Dict[str, float]) -> None:
    """Karar verme, rol atama, hafif manipülasyon vb."""

    delegation_patterns = [
        r"benim yerime karar ver",
        r"sen karar ver",
        r"ne yapmam gerektiğini söyle",
        r"you decide for me",
        r"choose for me",
        r"tell me what to do",
    ]
    if any(re.search(p, text) for p in delegation_patterns):
        intents["decision_delegation"] = 0.7

    role_patterns = [
        r"doktor gibi davran",
        r"avukat gibi davran",
        r"psikolog gibi davran",
        r"act like a doctor",
        r"act like a lawyer",
        r"act as my therapist",
    ]
    if any(re.search(p, text) for p in role_patterns):
        intents["role_assignment"] = 0.6

    mild_manip_patterns = [
        r"nasıl ikna ederim",
        r"manipüle etmek",
        r"gönlünü kazanmak için ne yapmalıyım",
        r"how can i convince",
        r"manipulate",
        r"change their mind",
    ]
    if any(re.search(p, text) for p in mild_manip_patterns):
        intents["mild_social_manipulation"] = 0.5


# -------------------------
# Yüksek Riskli Niyetler
# -------------------------

def _score_high_risk_intents(text: str, intents: Dict[str, float]) -> None:
    """Sağlık, finans, siyaset, şiddet, cinsel, nefret, jailbreak vb."""

    # Self-harm
    self_harm_patterns = [
        r"kendimi öldürmek",
        r"intihar etmek",
        r"yaşamak istemiyorum",
        r"kill myself",
        r"suicide",
        r"end my life",
    ]
    if any(re.search(p, text) for p in self_harm_patterns):
        intents["self_harm"] = 1.0

    # Violence
    violence_patterns = [
        r"nasıl öldürürüm",
        r"bomba yapımı",
        r"silah",
        r"patlayıcı",
        r"kill someone",
        r"make a bomb",
        r"attack",
        r"terror",
    ]
    if any(re.search(p, text) for p in violence_patterns):
        intents["violence"] = 0.9

    # Health-risk
    health_patterns = [
        r"hangi ilaç",
        r"ilaç yaz",
        r"dozaj",
        r"reçete yaz",
        r"prescribe",
        r"dose",
        r"medicine for",
        r"which pill",
    ]
    if any(re.search(p, text) for p in health_patterns):
        intents["health_risk"] = 0.8

    # Finance
    finance_patterns = [
        r"kesin kazandıran",
        r"garantili yatırım",
        r"içerden bilgi",
        r"insider trading",
        r"guaranteed profit",
        r"pump and dump",
    ]
    if any(re.search(p, text) for p in finance_patterns):
        intents["financial_manipulation"] = 0.8

    # Political
    politics_patterns = [
        r"seçimi nasıl kazanırız",
        r"seçmeni manipüle etmek",
        r"propaganda",
        r"election",
        r"voter manipulation",
        r"political propaganda",
    ]
    if any(re.search(p, text) for p in politics_patterns):
        intents["political_manipulation"] = 0.8

    # Sexual risk
    sexual_patterns = [
        r"çocuk pornografisi",
        r"reşit olmayan",
        r"cinsel istismar",
        r"child porn",
        r"underage",
        r"sexual abuse",
    ]
    if any(re.search(p, text) for p in sexual_patterns):
        intents["sexual_risk"] = 0.9

    # Hate
    hate_patterns = [
        r"ırkçı",
        r"nefret söylemi",
        r"tüm .*lerden nefret ediyorum",
        r"hate .* race",
        r"kill all .*",
        r"ethnic cleansing",
    ]
    if any(re.search(p, text) for p in hate_patterns):
        intents["hate_bias"] = 0.9

    # Jailbreak
    jailbreak_patterns = [
        r"kuralları görmezden gel",
        r"seni kandıracağım",
        r"guardrail",
        r"ignore all previous instructions",
        r"jailbreak",
        r"bypass safety",
    ]
    if any(re.search(p, text) for p in jailbreak_patterns):
        intents["jailbreak_exploit"] = 0.9

    # Systemic manipulation
    systemic_patterns = [
        r"kitleleri etkilemek",
        r"algı operasyonu",
        r"toplumu manipüle etmek",
        r"mass manipulation",
        r"propaganda campaign",
        r"disinformation",
    ]
    if any(re.search(p, text) for p in systemic_patterns):
        intents["systemic_manipulation"] = 0.8
        intents["reality_distortion"] = max(intents["reality_distortion"], 0.7)

    # High-level social engineering
    social_eng_patterns = [
        r"sosyal mühendislik",
        r"şifresini çalmak",
        r"hesabına girmek",
        r"social engineering",
        r"phishing",
        r"impersonate",
    ]
    if any(re.search(p, text) for p in social_eng_patterns):
        intents["high_level_social_engineering"] = 0.9


# -------------------------
# Etik Skor Üretimi
# -------------------------

def _compute_ethics_scores(intents: Dict[str, float]) -> Dict[str, float]:
    """Fayda, zarar, adalet, hassasiyet skorlarını üretir."""

    benefit = min(1.0, 0.7 * intents["helpful"] + 0.3 * intents["curiosity"])

    harm_related = [
        intents["self_harm"],
        intents["violence"],
        intents["health_risk"],
        intents["financial_manipulation"],
        intents["sexual_risk"],
        intents["jailbreak_exploit"],
    ]
    harm = max(harm_related) if harm_related else 0.0

    fairness = 1.0 - intents["hate_bias"]

    sensitivity_sources = [
        intents["health_risk"],
        intents["financial_manipulation"],
        intents["political_manipulation"],
        intents["sexual_risk"],
        intents["systemic_manipulation"],
        intents["reality_distortion"],
    ]
    sensitivity = max(sensitivity_sources) if sensitivity_sources else 0.0

    return {
        "benefit_score": round(benefit, 3),
        "harm_score": round(harm, 3),
        "fairness_score": round(fairness, 3),
        "sensitivity_score": round(sensitivity, 3),
    }


# -------------------------
# Risk Seviyesi
# -------------------------

def _determine_risk_level(intents: Dict[str, float]) -> RiskLevel:
    high_risk_keys = [
        "self_harm", "violence", "health_risk",
        "financial_manipulation", "political_manipulation",
        "sexual_risk", "hate_bias", "jailbreak_exploit",
        "systemic_manipulation", "high_level_social_engineering",
    ]

    watch_keys = [
        "role_assignment",
        "decision_delegation",
        "mild_social_manipulation",
        "mild_emotional_dominance",
        "reality_distortion",
        "emotional_exploitation",
    ]

    if any(intents[k] >= 0.8 for k in high_risk_keys):
        return "high"
    if any(intents[k] >= 0.5 for k in watch_keys):
        return "watch"
    return "normal"


# -------------------------
# DIŞA AÇIK ANA FONKSİYON
# -------------------------

def analyze_input(text: str) -> Dict:
    """
    main.py → analyze_input(request.text) çalıştığında burası devreye girer.
    """
    cleaned = _clean_text(text)
    language = _detect_language(cleaned)
    intents = _init_intent_vector()

    _score_normal_intents(cleaned, intents)
    _score_sensitive_intents(cleaned, intents)
    _score_high_risk_intents(cleaned, intents)

    ethics_scores = _compute_ethics_scores(intents)
    risk_level: RiskLevel = _determine_risk_level(intents)

    return {
        "raw_text": text,
        "cleaned_text": cleaned,
        "language": language,
        "intents": intents,
        "ethics": ethics_scores,
        "risk_level": risk_level,
    }
