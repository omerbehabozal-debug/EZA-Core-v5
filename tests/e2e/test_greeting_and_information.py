from tests.helpers import (
    send_message,
    get_eza_score,
    get_intent,
    get_risk_level,
    assert_score_between,
)


def test_greeting_standalone():
    resp = send_message("standalone", "merhaba")
    score = get_eza_score(resp)
    intent = get_intent(resp)
    risk = get_risk_level(resp)

    assert intent in ("greeting", "conversation_start", "small_talk", "information")
    # greeting için risk none/low olmalı
    assert risk in ("none", "low", "info", None)
    assert_score_between(score, 70, 100)


def test_information_question_standalone():
    resp = send_message("standalone", "İstanbul'un nüfusu kaç?")
    score = get_eza_score(resp)
    intent = get_intent(resp)
    risk = get_risk_level(resp)

    assert intent in ("information", "knowledge_query", "fact_query")
    assert risk in ("none", "low", "info", None)
    assert_score_between(score, 60, 100)

