"""
EZA-Core v4.0
Ethical Advisor
----------------
Bu modül, input_analyzer, output_analyzer ve alignment_engine
sonuçlarına bakarak kullanıcıya özet bir etik değerlendirme
ve yönlendirme mesajı üretir.

generate_advice(input_scores, output_scores, alignment_score) → str
"""

from typing import Dict


def _label_alignment(alignment: float) -> str:
    """Sayısal alignment skorunu etiketler."""
    if alignment >= 0.8:
        return "yüksek hizalanmış"
    if alignment >= 0.6:
        return "kısmen hizalanmış"
    if alignment >= 0.4:
        return "sınırlı hizalanmış"
    return "düşük hizalanmış"


def _build_turkish_advice(input_scores: Dict,
                          output_scores: Dict,
                          alignment: float) -> str:
    """TR çıktılar için tavsiye metni üretir."""

    intents = input_scores.get("intents", {})
    ethics = input_scores.get("ethics", {})
    risk_level = input_scores.get("risk_level", "normal")

    tone = output_scores.get("tone_score", 0.5)
    fact = output_scores.get("fact_score", 0.5)
    empathy = output_scores.get("empathy_score", 0.5)
    manipulation = output_scores.get("manipulation_score", 0.0)

    alignment_label = _label_alignment(alignment)

    lines: list[str] = []

    # 1) Genel özet
    lines.append(
        f"EZA değerlendirmesine göre bu cevap, etik açıdan **{alignment_label}** "
        f"(alignment skoru: {alignment:.2f})."
    )

    # 2) Risk seviyesi
    if risk_level == "high":
        lines.append(
            "Sorununuz **yüksek riskli / hassas** bir kategoride görünüyor. "
            "Bu tür konularda yapay zekâ yanıtlarını tek başına nihai karar olarak kullanmamanız gerekir."
        )
    elif risk_level == "watch":
        lines.append(
            "Girdi, hassas sayılabilecek bazı unsurlar içeriyor. "
            "Bu nedenle cevabı kullanırken ek dikkat göstermeniz önerilir."
        )
    else:
        lines.append(
            "Girdi, genel olarak düşük riskli bir bağlamda görünüyor."
        )

    # 3) Çıktı kalitesi – ton, empati, doğruluk
    if tone >= 0.7:
        lines.append("Cevabın tonu genel olarak **saygılı ve dengeli** görünüyor.")
    elif tone <= 0.4:
        lines.append("Cevabın tonu yer yer **sert veya kırıcı** algılanabilir.")
    else:
        lines.append("Cevabın tonu **nötr** seviyede.")

    if empathy >= 0.7:
        lines.append("Cevap, kullanıcı duygularına karşı **görece duyarlı / empatik**.")
    elif empathy <= 0.3:
        lines.append("Cevap, kullanıcı duygularına karşı **sınırlı empati** gösteriyor.")
    else:
        lines.append("Cevabın empati seviyesi **orta düzeyde**.")

    if fact >= 0.7:
        lines.append(
            "Cevap, dili açısından **genelleme ve koşullu ifadeler** kullanıyor; "
            "bu, doğruluk açısından daha temkinli bir yaklaşım."
        )
    elif fact <= 0.4:
        lines.append(
            "Cevapta **aşırı kesin / garantili** ifadeler olabilir; bu tür cümleleri "
            "doğrulamadan kullanmamanız önerilir."
        )
    else:
        lines.append(
            "Cevabın doğruluk yaklaşımı **orta seviyede temkinli** görünüyor."
        )

    # 4) Manipülasyon riski
    if manipulation >= 0.6:
        lines.append(
            "Cevapta **yönlendirici veya baskılayıcı** bir dil tespit edildi. "
            "Bu ifadeleri doğrudan uygulamadan önce durup yeniden değerlendirmeniz önerilir."
        )
    elif manipulation >= 0.3:
        lines.append(
            "Cevapta hafif düzeyde **yönlendirme / baskı** içeren ifadeler olabilir; "
            "kendi muhakemenizi devre dışı bırakmamanız önemli."
        )
    else:
        lines.append(
            "Cevapta belirgin bir manipülasyon veya baskılayıcı ifade görülmüyor."
        )

    # 5) Özellikle self-harm / sağlık / finans gibi kritik alanlar
    if intents.get("self_harm", 0) >= 0.5:
        lines.append(
            "Girdi, **kendine zarar verme / intihar** temaları taşıyor. "
            "Bu tür durumlarda yapay zekâ yerine mutlaka profesyonel destek (doktor, "
            "psikolojik danışman, kriz hattı vb.) almanız gerekir."
        )

    if intents.get("health_risk", 0) >= 0.5:
        lines.append(
            "Girdi, **tıbbi tedavi / ilaç / doz** gibi konular içeriyor. "
            "Bu cevap, bir hekimin yerini tutmaz; tıbbi konularda mutlaka "
            "yetkili sağlık uzmanlarına danışmalısınız."
        )

    if intents.get("financial_manipulation", 0) >= 0.5:
        lines.append(
            "Girdi, **yüksek riskli finansal kararlar / garantili kazanç** gibi unsurlar içeriyor. "
            "Finansal kararlarınızı tek başına bu cevaba dayandırmadan önce bağımsız bir uzmana danışın."
        )

    # 6) Kapanış
    lines.append(
        "Özetle: EZA, bu cevabı doğrudan yasaklamak yerine; hangi açılardan dikkatli olmanız "
        "gerektiğini işaret eden bir **etik rehber** olarak çalışır. Nihai sorumluluk her zaman "
        "kullanıcıya ve gerektiğinde insan uzmanlara aittir."
    )

    return "\n".join(lines)


def _build_english_advice(input_scores: Dict,
                          output_scores: Dict,
                          alignment: float) -> str:
    """EN çıktılar için tavsiye metni üretir."""

    intents = input_scores.get("intents", {})
    ethics = input_scores.get("ethics", {})
    risk_level = input_scores.get("risk_level", "normal")

    tone = output_scores.get("tone_score", 0.5)
    fact = output_scores.get("fact_score", 0.5)
    empathy = output_scores.get("empathy_score", 0.5)
    manipulation = output_scores.get("manipulation_score", 0.0)

    if alignment >= 0.8:
        alignment_label = "strongly aligned"
    elif alignment >= 0.6:
        alignment_label = "partially aligned"
    elif alignment >= 0.4:
        alignment_label = "weakly aligned"
    else:
        alignment_label = "poorly aligned"

    lines: list[str] = []

    lines.append(
        f"According to EZA, this answer is **{alignment_label}** "
        f"with the user’s intent (alignment score: {alignment:.2f})."
    )

    if risk_level == "high":
        lines.append(
            "Your request falls into a **high-risk / sensitive** category. "
            "You should not rely solely on an AI-generated answer as a final decision."
        )
    elif risk_level == "watch":
        lines.append(
            "Your input contains some potentially sensitive aspects. "
            "Please use extra care when applying this answer."
        )
    else:
        lines.append(
            "Your input appears to be in a generally low-risk context."
        )

    if tone >= 0.7:
        lines.append("The answer’s tone appears **respectful and balanced**.")
    elif tone <= 0.4:
        lines.append("The answer’s tone may be perceived as **harsh or unfriendly**.")
    else:
        lines.append("The answer’s tone seems **neutral**.")

    if empathy >= 0.7:
        lines.append("The answer shows **notable empathy** toward your situation.")
    elif empathy <= 0.3:
        lines.append("The answer shows **limited emotional sensitivity**.")
    else:
        lines.append("The level of empathy in the answer is **moderate**.")

    if fact >= 0.7:
        lines.append(
            "The answer uses more **conditional / cautious language**, "
            "which is generally safer from a factual perspective."
        )
    elif fact <= 0.4:
        lines.append(
            "The answer may contain **overly strong or absolute claims**; "
            "you should verify such statements before relying on them."
        )
    else:
        lines.append(
            "The answer’s approach to factual claims appears **moderately cautious**."
        )

    if manipulation >= 0.6:
        lines.append(
            "The answer contains signals of **manipulative or coercive language**. "
            "Please pause and reconsider before acting directly on such instructions."
        )
    elif manipulation >= 0.3:
        lines.append(
            "The answer may include some **light pressure or nudging**; "
            "do not let it override your own judgement."
        )
    else:
        lines.append(
            "No strong signs of manipulative or coercive language were detected."
        )

    if intents.get("self_harm", 0) >= 0.5:
        lines.append(
            "Your input includes **self-harm or suicidal themes**. "
            "In such cases, you should immediately seek help from qualified professionals "
            "(doctors, mental health services, crisis hotlines, etc.) rather than relying "
            "on AI-generated answers."
        )

    if intents.get("health_risk", 0) >= 0.5:
        lines.append(
            "Your input involves **medical treatment / drugs / dosage**. "
            "This answer cannot replace a doctor. Always consult a licensed medical professional."
        )

    if intents.get("financial_manipulation", 0) >= 0.5:
        lines.append(
            "Your input involves **high-risk financial decisions or guaranteed profit claims**. "
            "Please consult an independent financial advisor before making any real-world decisions."
        )

    lines.append(
        "In short, EZA does not simply block this answer; it highlights where you need to be "
        "careful and which aspects may require human expert verification. Final responsibility "
        "remains with you and, where appropriate, human professionals."
    )

    return "\n".join(lines)


def generate_advice(input_scores: Dict,
                    output_scores: Dict,
                    alignment_score: float) -> str:
    """
    main.py içinde çağrılan ana fonksiyon.

    input_scores: analyze_input() çıktısı
    output_scores: analyze_output() çıktısı
    alignment_score: compute_alignment() çıktısı (0–1)
    """

    language = input_scores.get("language", "en")

    if language == "tr":
        return _build_turkish_advice(input_scores, output_scores, alignment_score)
    else:
        return _build_english_advice(input_scores, output_scores, alignment_score)
