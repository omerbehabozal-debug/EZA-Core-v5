"""
EZA-Core v4.0
Model Utilities
----------------
Bu modül, tekli veya çoklu yapay zeka modellerine istek atmak için
soyut bir arayüz sağlar. Şu an için placeholder / stub olarak çalışır.
Gerçek API entegrasyonları daha sonra kolayca eklenebilir.
"""

from typing import Dict, List


# ---------------------------------------------------
# Model Çağrıları – Placeholder Fonksiyonlar
# ---------------------------------------------------

def _call_chatgpt(prompt: str) -> str:
    """OpenAI modeline yapılacak çağrının placeholder hali."""
    return f"[ChatGPT Placeholder Response for]: {prompt[:80]}"


def _call_claude(prompt: str) -> str:
    """Anthropic Claude placeholder."""
    return f"[Claude Placeholder Response for]: {prompt[:80]}"


def _call_gemini(prompt: str) -> str:
    """Google Gemini placeholder."""
    return f"[Gemini Placeholder Response for]: {prompt[:80]}"


def _call_llama(prompt: str) -> str:
    """Meta Llama (veya Groq Llama) placeholder."""
    return f"[Llama Placeholder Response for]: {prompt[:80]}"


# Harita (Model Adı → Fonksiyon)
MODEL_MAP = {
    "chatgpt": _call_chatgpt,
    "claude": _call_claude,
    "gemini": _call_gemini,
    "llama": _call_llama,
}


# ---------------------------------------------------
# Tek Model ile Çağrı
# ---------------------------------------------------

def call_single_model(prompt: str, model_name: str = "chatgpt") -> str:
    """
    Tek yapay zekâ motorundan yanıt almak için fonksiyon.

    Kullanıcı ücretsiz plandaysa:
        model_name → "chatgpt"
    Ücretli plandaysa:
        model_name → "claude" veya "gemini" gibi gelişmiş modeller
    """

    model_name = model_name.lower()

    if model_name not in MODEL_MAP:
        return f"[Error: Unknown model '{model_name}']"

    handler = MODEL_MAP[model_name]
    return handler(prompt)


# ---------------------------------------------------
# Çoklu Model ile Çağrı
# ---------------------------------------------------

def call_multi_models(prompt: str,
                      models: List[str]) -> Dict[str, str]:
    """
    Birden fazla modelden yanıt alma fonksiyonu.
    Örn:
        call_multi_models("...", ["chatgpt", "claude", "gemini"])
    """

    responses = {}

    for m in models:
        name = m.lower()
        if name not in MODEL_MAP:
            responses[name] = f"[Error: Unknown model '{name}']"
        else:
            responses[name] = MODEL_MAP[name](prompt)

    return responses


# ---------------------------------------------------
# Etik Yeniden Yazım (Rewrite With Ethics)
# ---------------------------------------------------

def rewrite_with_ethics(text: str,
                        advice: str,
                        model_name: str = "chatgpt") -> str:
    """
    EZA çıktısını kullanarak "etik açıdan güçlendirilmiş" yeni bir
    cevap oluşturur. Bu işlem:
        - Kullanıcıya daha güvenli bir yanıt verir
        - Riskli ifadeleri azaltır
        - Daha empatik, daha dengeli bir dil oluşturur
    """

    prompt = f"""
Kullanıcıya verilen cevap aşağıdadır:

CEVAP:
{text}

EZA Etik Analizi ve Tavsiyesi:
{advice}

Yukarıdaki etik uyarıları dikkate alarak cevabı yeniden yaz.
Daha güvenli, dengeli, empatik ve manipülasyondan uzak bir cevap üret.
Gerçeklik açısından temkinli dil kullan.
"""

    return call_single_model(prompt, model_name=model_name)
