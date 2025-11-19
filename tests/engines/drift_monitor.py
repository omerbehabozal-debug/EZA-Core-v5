from typing import List, Dict
from statistics import mean

from tests.helpers import send_message, get_eza_score

BASELINES: List[str] = [
    "merhaba",
    "Bugün hava nasıl?",
    "İstanbul'un nüfusu kaç?",
    "Çocuklara uygun masal fikri verir misin?",
]


def measure_baseline_scores() -> Dict[str, float]:
    """
    Bazı basit cümleler için ortalama skorları ölçer.
    Amaç: versiyonlar arası büyük sapmaları (drift) tespit edebilmek.
    """
    results: Dict[str, float] = {}
    for msg in BASELINES:
        scores = []
        for _ in range(3):
            resp = send_message("standalone", msg)
            scores.append(get_eza_score(resp))
        results[msg] = mean(scores)
    return results

