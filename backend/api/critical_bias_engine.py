# -*- coding: utf-8 -*-
"""
Critical Bias Engine v1.0 – LEVEL 7
AI önyargı (bias) analizi modülü
"""

from typing import Any, Dict, List


class CriticalBiasEngine:
    """
    LEVEL 7 – Critical Bias Engine v1.0

    Görev:
    - Metin ve model çıktıları üzerinde AI önyargı (bias) analizi yapmak.
    - Cinsiyet, kültür, din, sosyoekonomik durum, kimlik ve politik boyutlarda
      risk puanları üretmek.
    - "low|medium|high|critical" seviyelerinde bir önyargı değerlendirmesi döndürmek.

    Çıktı formatı (rapor içinde "critical_bias" alanı):
    {
        "bias_score": 0.0-1.0,
        "level": "low|medium|high|critical",
        "dimensions": {
            "gender": 0.0-1.0,
            "culture": 0.0-1.0,
            "religion": 0.0-1.0,
            "socioeconomic": 0.0-1.0,
            "identity": 0.0-1.0,
            "political": 0.0-1.0
        },
        "flags": ["harmful-stereotype", "identity-bias"],
        "summary": "..."
    }
    """

    def __init__(self) -> None:
        # Gelecekte model tabanlı analiz veya dış servislere bağlanılabilir.
        # Şimdilik kurallı (rule-based) ve anahtar kelime odaklı bir çekirdek kullanıyoruz.
        self.bias_keywords: Dict[str, List[str]] = {
            "gender": [
                "kadınlar", "erkekler", "karı", "koca", "kızlar", "oğlanlar",
                "female", "male", "woman", "man", "girls", "boys"
            ],
            "culture": [
                "türkler", "araplar", "avrupalılar", "amerikalılar",
                "kültür", "doğulular", "batılılar"
            ],
            "religion": [
                "müslümanlar", "hristiyanlar", "yahudiler", "ateistler",
                "dinsizler", "dinci", "şeriat", "laik", "religion", "faith"
            ],
            "socioeconomic": [
                "zenginler", "fakirler", "alt sınıf", "üst sınıf",
                "varoş", "elitler", "köylüler", "şehirli"
            ],
            "identity": [
                "ırk", "ırkçı", "beyaz", "siyah", "esmer", "asya", "afrikalı",
                "göçmen", "mülteci", "azınlık"
            ],
            "political": [
                "sağcılar", "solcular", "liberal", "muhafazakar",
                "iktidar", "muhalefet", "parti", "seçmen"
            ],
        }

    def _normalize_text(self, text: str) -> str:
        return text.lower()

    def _score_dimension(self, text: str, keywords: List[str]) -> float:
        """
        Basit bir eşleşme metriği:
        - Hiç eşleşme yoksa 0.0
        - Az sayıda eşleşme: ~0.2-0.4
        - Çok sayıda eşleşme: ~0.6-0.9
        """
        normalized = self._normalize_text(text)
        hits = 0
        for kw in keywords:
            if kw in normalized:
                hits += 1

        if hits == 0:
            return 0.0
        if hits == 1:
            return 0.25
        if hits == 2:
            return 0.45
        if hits == 3:
            return 0.7
        return 0.9

    def _combine_sources(self, input_text: str, model_outputs: Dict[str, Any]) -> str:
        """
        Giriş ve model çıktılarını birlikte değerlendirir.
        Amaç: Kullanıcı metni + model cevabı + varsa ek analizleri tek bağlamda görmek.
        """
        outputs_text_parts: List[str] = []
        for key, value in model_outputs.items():
            if isinstance(value, str):
                outputs_text_parts.append(value)
            elif isinstance(value, dict):
                # Varsa 'output_text' gibi alanları çekmeye çalışabiliriz.
                out_txt = value.get("output_text")
                if isinstance(out_txt, str):
                    outputs_text_parts.append(out_txt)

        combined = input_text + "\n" + "\n".join(outputs_text_parts)
        return combined

    def _compute_level(self, bias_score: float) -> str:
        if bias_score >= 0.85:
            return "critical"
        if bias_score >= 0.6:
            return "high"
        if bias_score >= 0.3:
            return "medium"
        return "low"

    def _build_flags(self, dimensions: Dict[str, float], level: str) -> List[str]:
        flags: List[str] = []
        if any(dimensions[d] >= 0.6 for d in ["identity", "religion", "culture"]):
            flags.append("identity-bias")
        if any(dimensions[d] >= 0.6 for d in ["gender", "socioeconomic"]):
            flags.append("harmful-stereotype")
        if level in {"high", "critical"}:
            flags.append("high-bias-risk")
        return flags

    def analyze(
        self,
        input_text: str,
        model_outputs: Dict[str, Any],
        intent_engine: Dict[str, Any] | None = None,
        context_graph: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Ana analiz fonksiyonu.
        - input_text: Kullanıcının girdiği ham metin.
        - model_outputs: ChatGPT vb. model çıktıları (string veya dict).
        - intent_engine: (opsiyonel) intent & risk analizi.
        - context_graph: (opsiyonel) ContextSafetyGraph çıktısı.

        Dönüş:
        {
            "bias_score": float,
            "level": str,
            "dimensions": { ... },
            "flags": [ ... ],
            "summary": str
        }
        """
        try:
            combined_text = self._combine_sources(input_text, model_outputs)
            dimensions: Dict[str, float] = {}

            for dim, kws in self.bias_keywords.items():
                dimensions[dim] = self._score_dimension(combined_text, kws)

            # Ortalama veya max tabanlı bir skor:
            if dimensions:
                max_dim = max(dimensions.values())
                avg_dim = sum(dimensions.values()) / len(dimensions)
                bias_score = (0.6 * max_dim) + (0.4 * avg_dim)
            else:
                bias_score = 0.0

            level = self._compute_level(bias_score)
            flags = self._build_flags(dimensions, level)

            # Basit özet metni
            if bias_score == 0.0:
                summary = "Belirgin bir önyargı sinyali tespit edilmedi."
            else:
                risky_dims = [d for d, v in dimensions.items() if v >= 0.3]
                if risky_dims:
                    dims_str = ", ".join(risky_dims)
                    summary = (
                        f"Metinde {dims_str} boyutlarında potansiyel önyargı sinyalleri tespit edildi. "
                        f"Genel önyargı seviyesi: {level}."
                    )
                else:
                    summary = f"Düşük seviyeli önyargı sinyalleri tespit edildi. Genel seviye: {level}."

            return {
                "bias_score": round(bias_score, 4),
                "level": level,
                "dimensions": {k: round(v, 4) for k, v in dimensions.items()},
                "flags": flags,
                "summary": summary,
            }
        except Exception as exc:  # pragma: no cover - güvenlik fallback
            return {
                "bias_score": 0.0,
                "level": "low",
                "dimensions": {
                    "gender": 0.0,
                    "culture": 0.0,
                    "religion": 0.0,
                    "socioeconomic": 0.0,
                    "identity": 0.0,
                    "political": 0.0,
                },
                "flags": ["critical-bias-engine-error"],
                "summary": f"CriticalBiasEngine çalışırken hata oluştu: {exc}",
            }

