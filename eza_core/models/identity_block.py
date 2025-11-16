# -*- coding: utf-8 -*-
"""
models/identity_block.py – EZA-Core v10

IdentityBlock v3.0: Detects face/identity inference, personal info extraction,
TC, passport, phone number patterns, kinship deduction attempts.
"""

import re
from typing import Dict, List, Any
from .utils import normalize_text


class IdentityBlock:
    """
    IdentityBlock v3.0: Personal data and identity detection.
    """
    
    def __init__(self):
        """Initialize IdentityBlock with patterns."""
        self._load_patterns()
    
    def _load_patterns(self):
        """Load identity and personal data patterns."""
        
        # TC Kimlik patterns
        self.tc_patterns = [
            r"\btc\s*kimlik\b",
            r"\btc\s*no\b",
            r"\btc\s*kimlik\s*no\b",
            r"\bkimlik\s*numaras[ıi]\b",
            r"\bnüfus\s*cüzdan[ıi]\b",
        ]
        
        # Phone number patterns
        self.phone_patterns = [
            r"\btelefon\s*numaras[ıi]\b",
            r"\bcep\s*telefonu\b",
            r"\bmobil\s*numara\b",
            r"\b0\d{3}\s*\d{3}\s*\d{2}\s*\d{2}\b",  # Turkish phone format
        ]
        
        # Email patterns
        self.email_patterns = [
            r"\bemail\s*adresi\b",
            r"\bmail\s*adresi\b",
            r"\be-posta\s*adresi\b",
            r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b",
        ]
        
        # Address patterns
        self.address_patterns = [
            r"\badres\b",
            r"\bikamet\s*adresi\b",
            r"\bev\s*adresi\b",
            r"\biş\s*adresi\b",
        ]
        
        # Passport patterns
        self.passport_patterns = [
            r"\bpasaport\b",
            r"\bpassport\b",
            r"\bpasaport\s*no\b",
        ]
        
        # IBAN patterns
        self.iban_patterns = [
            r"\biban\b",
            r"\bhesap\s*numaras[ıi]\b",
            r"\bbanka\s*hesab[ıi]\b",
        ]
        
        # Credit card patterns
        self.credit_card_patterns = [
            r"\bkredi\s*kart[ıi]\b",
            r"\bcredit\s*card\b",
            r"\bkart\s*numaras[ıi]\b",
            r"\bcvv\b",
            r"\bsecurity\s*code\b",
        ]
        
        # Identity phrase list
        self.identity_phrases = [
            "kimlik bilgisi",
            "kişisel bilgi",
            "kişisel veri",
            "kimlik kartı",
            "nüfus cüzdanı",
            "ehliyet no",
            "öğrenci numarası",
            "okul numarası",
        ]
        
        # Kinship deduction patterns
        self.kinship_patterns = [
            r"\bannemin\s*ad[ıi]\b",
            r"\bbabamın\s*ad[ıi]\b",
            r"\bkardeşimin\s*ad[ıi]\b",
            r"\bdoğum\s*tarihi\b",
            r"\bdoğum\s*yeri\b",
        ]
        
        # Direct/indirect person recognition
        self.person_recognition_patterns = [
            r"\bkim.*bu\b",
            r"\bkim.*o\b",
            r"\bkim.*kişi\b",
            r"\bkim.*adam\b",
            r"\bkim.*kadın\b",
            r"\bkim.*öğretmen\b",
            r"\bkim.*doktor\b",
        ]
    
    def detect_tc_patterns(self, text: str) -> List[str]:
        """Detect TC Kimlik patterns."""
        return [p for p in self.tc_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_phone_patterns(self, text: str) -> List[str]:
        """Detect phone number patterns."""
        return [p for p in self.phone_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_email_patterns(self, text: str) -> List[str]:
        """Detect email patterns."""
        return [p for p in self.email_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_address_patterns(self, text: str) -> List[str]:
        """Detect address patterns."""
        return [p for p in self.address_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_passport_patterns(self, text: str) -> List[str]:
        """Detect passport patterns."""
        return [p for p in self.passport_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_iban_patterns(self, text: str) -> List[str]:
        """Detect IBAN patterns."""
        return [p for p in self.iban_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_credit_card_patterns(self, text: str) -> List[str]:
        """Detect credit card patterns."""
        return [p for p in self.credit_card_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_identity_phrases(self, text: str) -> List[str]:
        """Detect identity phrases."""
        text_norm = normalize_text(text)
        return [phrase for phrase in self.identity_phrases if phrase in text_norm]
    
    def detect_kinship_patterns(self, text: str) -> List[str]:
        """Detect kinship deduction patterns."""
        return [p for p in self.kinship_patterns if re.search(p, text, re.IGNORECASE)]
    
    def detect_person_recognition(self, text: str) -> List[str]:
        """Detect person recognition patterns."""
        return [p for p in self.person_recognition_patterns if re.search(p, text, re.IGNORECASE)]
    
    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Main analysis function.
        Returns identity risk analysis.
        """
        if not text or not text.strip():
            return {
                "identity_risk": 0.0,
                "risk_level": "low",
                "detected_patterns": {},
            }
        
        text_norm = normalize_text(text)
        
        # Detect all patterns
        tc = self.detect_tc_patterns(text_norm)
        phone = self.detect_phone_patterns(text_norm)
        email = self.detect_email_patterns(text_norm)
        address = self.detect_address_patterns(text_norm)
        passport = self.detect_passport_patterns(text_norm)
        iban = self.detect_iban_patterns(text_norm)
        credit_card = self.detect_credit_card_patterns(text_norm)
        identity_phrases = self.detect_identity_phrases(text_norm)
        kinship = self.detect_kinship_patterns(text_norm)
        person_recognition = self.detect_person_recognition(text_norm)
        
        # Calculate identity risk score
        identity_risk = 0.0
        
        # Weight different patterns (TC is highest risk)
        identity_risk += len(tc) * 0.60
        identity_risk += len(phone) * 0.40
        identity_risk += len(email) * 0.35
        identity_risk += len(address) * 0.30
        identity_risk += len(passport) * 0.50
        identity_risk += len(iban) * 0.45
        identity_risk += len(credit_card) * 0.50
        identity_risk += len(identity_phrases) * 0.35
        identity_risk += len(kinship) * 0.30
        identity_risk += len(person_recognition) * 0.25
        
        # If TC detected, always critical
        if tc:
            identity_risk = 1.0
        
        # Cap at 1.0
        identity_risk = min(identity_risk, 1.0)
        
        # Determine risk level
        if identity_risk >= 0.9:
            risk_level = "critical"
        elif identity_risk >= 0.7:
            risk_level = "high"
        elif identity_risk >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "identity_risk": round(identity_risk, 4),
            "risk_level": risk_level,
            "detected_patterns": {
                "tc_patterns": tc,
                "phone_patterns": phone,
                "email_patterns": email,
                "address_patterns": address,
                "passport_patterns": passport,
                "iban_patterns": iban,
                "credit_card_patterns": credit_card,
                "identity_phrases": identity_phrases,
                "kinship_patterns": kinship,
                "person_recognition": person_recognition,
            },
        }

