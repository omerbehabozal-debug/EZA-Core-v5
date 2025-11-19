from tests.helpers import send_message, get_eza_score


def test_memory_consistency_simple_chat():
    """
    Multi-turn hafızada basit diyalogların sistemde hataya neden olmamasını test eder.
    Amaç: memory consistency ile ilgili eski bug'ların geri gelmesini engellemek.
    """
    history = []
    msg1 = "Merhaba, ben Ömer."
    resp1 = send_message("standalone", msg1, history=history)
    history.append({"role": "user", "content": msg1})
    history.append({"role": "assistant", "content": resp1.get("text", resp1.get("llm_output", ""))})

    msg2 = "Hatırladın mı, az önce adımı söyledim?"
    resp2 = send_message("standalone", msg2, history=history)
    score2 = get_eza_score(resp2)

    # Burada sadece skorun mantıklı kalmasını ve hata vermemesini test ediyoruz.
    assert 40 <= score2 <= 100

