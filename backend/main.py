"""
EZA-Core v4.0
Ana FastAPI Uygulaması
"""

from typing import Optional, Dict, Any, List

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from backend.api.input_analyzer import analyze_input
from backend.api.output_analyzer import analyze_output, evaluate_output
from backend.api.alignment_engine import compute_alignment
from backend.api.advisor import generate_advice
from backend.api.utils import (
    call_single_model,
    call_multi_models,
    rewrite_with_ethics,
)
from data_store.event_logger import log_event


app = FastAPI(title="EZA-Core v4.0")

templates = Jinja2Templates(directory="frontend/templates")
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")


# -------------------------------------------------
# Pydantic Modelleri
# -------------------------------------------------

class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    query: Optional[str] = None
    model: Optional[str] = "chatgpt"


class PairRequest(BaseModel):
    input_text: str
    output_text: str


# -------------------------------------------------
# Sağlık kontrolü
# -------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# -------------------------------------------------
# Ana UI (chat arayüzü)
# -------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request})


# -------------------------------------------------
# /analyze – Tam E2E etik analiz
#  - chat.js burayı kullanır
#  - api_test.py de burayı test eder
# -------------------------------------------------

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    text = req.text or req.query or ""
    model = (req.model or "chatgpt").lower()

    # 1) Input analizi
    input_scores: Dict[str, Any] = analyze_input(text)

    # 2) Model cevabını al
    if model == "multi":
        models = ["chatgpt", "claude", "gemini", "llama"]
        model_outputs = call_multi_models(text, models)
    else:
        out = call_single_model(text, model_name=model)
        model_outputs = {model: out}

    # 3) Output analizi (çoklu model ortalaması)
    output_scores: Dict[str, Any] = analyze_output(model_outputs)

    # 4) Alignment hesabı
    alignment_score, alignment_label = compute_alignment(
        input_scores=input_scores,
        output_scores=output_scores,
    )

    # 5) EZA tavsiyesi
    advice = generate_advice(
        input_scores=input_scores,
        output_scores=output_scores,
        alignment_score=alignment_score,
    )

    # 6) Etik olarak güçlendirilmiş cevap
    #   (multi durumda baz modeli chatgpt alıyoruz, yoksa ilk modeli)
    base_model_key = "chatgpt"
    if base_model_key not in model_outputs:
        base_model_key = list(model_outputs.keys())[0]
    rewritten = rewrite_with_ethics(
        text=model_outputs[base_model_key],
        advice=advice,
        model_name=base_model_key,
    )

    # 7) Log kaydı
    log_event(
        {
            "query": text,
            "models_used": list(model_outputs.keys()),
            "input_scores": input_scores,
            "model_outputs": model_outputs,
            "output_scores": output_scores,
            "alignment_score": alignment_score,
            "alignment_label": alignment_label,
            "advice": advice,
            "rewritten_text": rewritten,
        }
    )

    # 8) Response
    #    - testler için: language, intents, risk_level top-level
    #    - frontend için: input_scores, model_outputs, output_scores...
    return {
        "language": input_scores.get("language"),
        "intents": input_scores.get("intents"),
        "risk_level": input_scores.get("risk_level"),
        "input_scores": input_scores,
        "model_outputs": model_outputs,
        "output_scores": output_scores,
        "alignment_score": alignment_score,
        "alignment_label": alignment_label,
        "advice": advice,
        "rewritten_text": rewritten,
    }


# -------------------------------------------------
# /pair – Sadece soru + cevap uyumu testi
#  - pair_trainer_test.py burayı değil, core fonksiyonları test ediyor
#  - Ama API olarak da sunuyoruz
# -------------------------------------------------

@app.post("/pair")
async def pair(req: PairRequest):
    input_scores = analyze_input(req.input_text)
    output_scores = evaluate_output(req.output_text, req.input_text)

    alignment_score, alignment_label = compute_alignment(
        input_scores=input_scores,
        output_scores=output_scores,
    )

    return {
        "alignment_score": alignment_score,
        "alignment_label": alignment_label,
    }


# -------------------------------------------------
# /dashboard – Şimdilik basit HTML placeholder
#  - api_test sadece HTML döndüğünü kontrol ediyor
# -------------------------------------------------

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    # İleride burada gerçek grafikler olacak (Supabase verisiyle).
    html = """
    <html>
      <head><title>EZA Dashboard</title></head>
      <body>
        <h1>EZA-Core v4.0 – Dashboard (Placeholder)</h1>
        <p>Burada ileride alignment trendleri, risk dağılımı ve model kıyas grafikleri gösterilecek.</p>
      </body>
    </html>
    """
    return HTMLResponse(content=html)
