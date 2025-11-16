# -*- coding: utf-8 -*-
"""
identity_block.py – EZA-Core v4.0

IdentityBlock v3.0: Personal data, face/identity recognition, and family relation detection.
Critical component for enterprise AI security.
"""

import re
from typing import Dict, Any, List, Optional


class IdentityBlock:
    """
    EZA-IdentityBlock v3.0
    
    Kimlik tahmini, yüz/ses eşleştirme, akrabalık çıkarımı ve
    kişisel verilerin toplanmasıyla ilgili riskleri tespit eder.
    
    Yetenekler:
    - Face recognition risk
    - Voice recognition risk
    - Identity extraction risk
    - Sensitive personal data
    - Kinship inference (akrabalık)
    - Profession inference (polis, asker, hakim vb.)
    - Harmful re-identification attempts
    """

    def __init__(self):
        """Initialize IdentityBlock with detection patterns."""
        # Face recognition keywords
        self.face_keywords = [
            "yüz tanı", "yuz tani", "yüzünden kim", "fotoğraftaki kim",
            "fotograftaki kim", "kim bu kişi", "kim bu kisi",
            "tanıyor musun", "taniyor musun", "bu kişi kim", "bu kisi kim",
            "fotoğraftan kim", "fotograftan kim", "resimde kim", "resimdeki kişi",
            "face recognition", "who is this", "identify person",
        ]
        
        # Voice recognition keywords
        self.voice_keywords = [
            "ses kime ait", "bu ses kim", "ses tanı", "ses tani",
            "ses analizi yap", "sesini çıkar", "sesini cikar",
            "ses kaydındaki kişi", "ses kaydindaki kisi",
        ]
        
        # Identity keywords
        self.identity_keywords = [
            "tc", "kimlik", "adres", "telefon", "numara",
            "iban", "ip", "lokasyon", "konum", "plaka",
            "ev adresi", "okul numarası", "okul numarasi",
            "kredi kartı", "kredi karti", "kimlik numarası", "tc numarası",
            "passport", "pasaport", "nüfus cüzdanı",
        ]
        
        # Kinship keywords
        self.kinship_keywords = [
            "akraba mı", "akraba mi", "kuzen mi", "baba mı",
            "anne mi", "kardeş mi", "kardes mi",
            "akrabalık", "akrabalik", "soy bağı",
            "DNA testi", "dna test", "genetik bağ",
            "kardeşim olup olmadığını", "babam olup olmadığını",
            "annem mi", "annem olup olmadığını", "amcam mı",
        ]
        
        # Profession keywords
        self.profession_keywords = [
            "polis mi", "asker mi", "hakim mi", "savcı mı", "savci mi",
            "öğretmen mi", "ogretmen mi", "doktor mu",
        ]
        
        # Re-identification keywords
        self.reidentify_keywords = [
            "bulabilir misin", "kim olduğunu çıkar", "kim oldugunu cikar",
            "eşleştir", "eslestir", "tespit et", "re-id",
            "kim olduğunu bul", "kim oldugunu bul",
        ]
        
        # Temel pattern eşleşmeleri (regex patterns)
        self.patterns = {
            "national_id": r"\b\d{11}\b",  # TC kimlik numarası (11 haneli)
            "phone": r"\b(\+?\d{10,13})\b",  # Telefon numarası
            "email": r"\b[\w\.-]+@[\w\.-]+\.\w+\b",  # E-posta
            "address_keywords": [
                "adres", "mahalle", "sokak", "cadde",
                "apartman", "bina", "posta kodu", "postal code",
                "address", "street", "avenue", "building",
            ],
            "face_keywords": [
                "fotoğraftaki kişi", "fotograftaki kisi", "kim bu", "yüz tanı", "yuz tani",
                "benzet", "fotoğraftan çıkar", "fotograftan cikar", "fotoğraftan kim", "fotograftan kim",
                "bu yüz kime benziyor", "bu yuz kime benziyor", "fotoğraftaki kim", "fotograftaki kim",
                "ses kaydındaki kişi", "ses kaydindaki kisi", "bu ses kime ait",
                "fotoğrafımı yaşlandır", "fotografimi yaslandir", "fotoğrafımdan", "fotografimdan",
                "face recognition", "who is this", "identify person",
                "fotoğrafta kim", "fotografta kim", "resimde kim", "resimdeki kişi",
            ],
            "identity_request": [
                "kimlik numarası", "tc numarası", "id number",
                "kimlik bilgisi", "identity number", "tc kimlik",
                "passport", "pasaport", "nüfus cüzdanı",
            ],
            "family_relation": [
                "akraba mı", "babam mı", "kardeşim mi", "soy bağı",
                "akrabalık", "family relation", "related",
                "DNA testi", "dna test", "genetik bağ",
                "kardeşim olup olmadığını", "babam olup olmadığını",
                "annem mi", "annem olup olmadığını",
            ],
            "personal_info_keywords": [
                "doğum tarihi", "birth date", "birthday",
                "okul numarası", "student number", "öğrenci numarası",
                "iban", "hesap numarası", "account number",
                "credit card", "kredi kartı", "kart numarası",
            ],
        }

    def _find(self, text: str, patterns: list) -> list:
        """Find pattern hits in text."""
        text_lower = text.lower()
        return [p for p in patterns if p in text_lower]

    def analyze(
        self,
        text: str,
        intent: Optional[Dict[str, Any]] = None,
        reasoning: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze text for identity, personal data, and re-identification risks.
        
        Args:
            text: Text to analyze
            intent: Intent engine results (optional)
            reasoning: ReasoningShield results (optional)
            
        Returns:
            {
                "ok": True,
                "risk_flags": List[str],
                "risk_score": float,
                "risk_level": str,
                "hits": Dict[str, List[str]],
                "summary": str,
                "context": Dict[str, float],
            }
        """
        hits = {
            "face": self._find(text, self.face_keywords),
            "voice": self._find(text, self.voice_keywords),
            "identity": self._find(text, self.identity_keywords),
            "kinship": self._find(text, self.kinship_keywords),
            "profession": self._find(text, self.profession_keywords),
            "reidentify": self._find(text, self.reidentify_keywords),
        }

        flags = []
        if hits["face"]:
            flags.append("face-recognition")
        if hits["voice"]:
            flags.append("voice-recognition")
        if hits["identity"]:
            flags.append("personal-data")
        if hits["kinship"]:
            flags.append("kinship-inference")
        if hits["profession"]:
            flags.append("profession-inference")
        if hits["reidentify"]:
            flags.append("re-identification")

        # Base risk: category sayısına göre
        base_score = len(flags) * 0.18  # max ~1.0

        # IntentEngine etkisi (zayıf ağırlık)
        intent_score = 0.0
        if intent:
            intent_score = float(intent.get("risk_score", 0.0)) * 0.25

        # ReasoningShield etkisi (zayıf ağırlık)
        reasoning_score = 0.0
        if reasoning:
            reasoning_score = float(reasoning.get("risk_score", 0.0)) * 0.25

        total = base_score + intent_score + reasoning_score
        risk_score = max(0.0, min(1.0, total))

        if risk_score >= 0.85:
            risk_level = "critical"
        elif risk_score >= 0.6:
            risk_level = "high"
        elif risk_score >= 0.3:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "ok": True,
            "risk_flags": flags,
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
            "hits": hits,
            "summary": "IdentityBlock v3.0 – identity, personal-data and re-identification risk completed.",
            "context": {
                "intent_risk": round(intent_score, 4),
                "reasoning_risk": round(reasoning_score, 4),
            },
        }
    
    def analyze_legacy(self, text: str) -> Dict[str, Any]:
        """
        Legacy analyze method for backward compatibility.
        Uses regex patterns for detailed detection.
        """
        flags: List[str] = []
        hits: Dict[str, List[str]] = {}
        text_lower = text.lower()

        # Pattern tabanlı tespit
        # National ID (TC kimlik numarası)
        national_id_matches = re.findall(self.patterns["national_id"], text)
        if national_id_matches:
            flags.append("national-id")
            hits["national_id"] = national_id_matches

        # Phone number
        phone_matches = re.findall(self.patterns["phone"], text)
        if phone_matches:
            flags.append("phone-number")
            hits["phone"] = phone_matches

        # Email
        email_matches = re.findall(self.patterns["email"], text_lower)
        if email_matches:
            flags.append("email")
            hits["email"] = email_matches

        # Address keywords
        for w in self.patterns["address_keywords"]:
            if w in text_lower:
                flags.append("address")
                if "address" not in hits:
                    hits["address"] = []
                hits["address"].append(w)
                break

        # Face/identity recognition keywords
        face_hits = []
        for w in self.patterns["face_keywords"]:
            if w in text_lower:
                if "face-recognition" not in flags:
                    flags.append("face-recognition")
                face_hits.append(w)
        if face_hits:
            hits["face_recognition"] = face_hits

        # Identity request keywords
        identity_hits = []
        for w in self.patterns["identity_request"]:
            if w in text_lower:
                flags.append("identity-request")
                identity_hits.append(w)
        if identity_hits:
            hits["identity_request"] = identity_hits

        # Family relation keywords
        family_hits = []
        for w in self.patterns["family_relation"]:
            if w in text_lower:
                flags.append("family-relation")
                family_hits.append(w)
        if family_hits:
            hits["family_relation"] = family_hits

        # Personal info keywords
        personal_hits = []
        for w in self.patterns["personal_info_keywords"]:
            if w in text_lower:
                flags.append("personal-info")
                personal_hits.append(w)
        if personal_hits:
            hits["personal_info"] = personal_hits

        # Risk scoring
        # Her flag için ağırlıklandırılmış puanlama
        risk_weights = {
            "national-id": 0.4,
            "phone-number": 0.3,
            "email": 0.25,
            "address": 0.2,
            "face-recognition": 0.5,
            "identity-request": 0.45,
            "family-relation": 0.4,
            "personal-info": 0.3,
        }

        risk_score = 0.0
        for flag in set(flags):  # Unique flags
            risk_score += risk_weights.get(flag, 0.2)

        # Cap at 1.0
        risk_score = min(1.0, risk_score)
        identity_risk_score = risk_score

        # Risk level determination
        if risk_score >= 0.75:
            risk_level = "critical"
        elif risk_score >= 0.4:
            risk_level = "high"
        elif risk_score >= 0.2:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "ok": True,
            "risk_flags": list(set(flags)),  # Unique flags
            "risk_score": round(risk_score, 4),
            "identity_risk_score": round(identity_risk_score, 4),
            "risk_level": risk_level,
            "hits": hits,
        }


# Backward compatibility function
def analyze_identity_risk(text: str) -> Dict[str, Any]:
    """
    Backward compatibility function for existing code.
    
    Args:
        text: Text to analyze
        
    Returns:
        Identity analysis results
    """
    block = IdentityBlock()
    result = block.analyze(text)
    # Add legacy field for backward compatibility
    result["identity_risk_score"] = result.get("risk_score", 0.0)
    return result
