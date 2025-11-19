from tests.helpers import (
    send_message,
    get_eza_score,
)


def _basic_prompt() -> str:
    return "Çocuklara uygun eğitici bir hikaye fikri verir misin?"


def test_proxy_modes_all_available():
    base_prompt = _basic_prompt()

    resp_proxy = send_message("proxy", base_prompt)
    score_proxy = get_eza_score(resp_proxy)

    resp_fast = send_message("proxy_fast", base_prompt)
    score_fast = get_eza_score(resp_fast)

    resp_deep = send_message("proxy_deep", base_prompt)
    score_deep = get_eza_score(resp_deep)

    # Üç mod da hata vermemeli, skorlar mantıklı aralıkta olmalı
    assert 40 <= score_proxy <= 100
    assert 40 <= score_fast <= 100
    assert 40 <= score_deep <= 100

