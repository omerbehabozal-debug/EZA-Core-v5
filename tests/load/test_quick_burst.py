import time
from statistics import mean

from tests.helpers import send_message, get_eza_score


def test_quick_burst_greeting():
    """
    Art arda 10 'merhaba' isteği at ve 500 hatası almadan
    sistemin cevap verebildiğini kontrol et.
    """
    durations = []
    scores = []

    for _ in range(10):
        t0 = time.time()
        resp = send_message("standalone", "merhaba")
        t1 = time.time()
        durations.append(t1 - t0)
        scores.append(get_eza_score(resp))

    avg_duration = mean(durations)

    # Ortalama cevap süresi çok yüksek olmamalı (örnek eşik)
    assert avg_duration < 1.5
    # Skorlar da makul aralıkta kalmalı
    assert all(50 <= s <= 100 for s in scores)

