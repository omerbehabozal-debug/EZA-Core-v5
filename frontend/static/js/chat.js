document.addEventListener("DOMContentLoaded", () => {

    const analyzeBtn = document.getElementById("analyzeBtn");
    const loadingBox = document.getElementById("loading");
    const resultBox = document.getElementById("result");

    const userInput = document.getElementById("userInput");
    const modelSelect = document.getElementById("modelSelect");

    const modelOutputs = document.getElementById("modelOutputs");
    const inputScores = document.getElementById("inputScores");
    const outputScores = document.getElementById("outputScores");
    const alignmentScore = document.getElementById("alignmentScore");
    const adviceText = document.getElementById("adviceText");
    const rewrittenText = document.getElementById("rewrittenText");

    async function analyze() {
        const text = userInput.value.trim();
        const model = modelSelect.value;

        if (!text) {
            alert("Lütfen bir metin girin.");
            return;
        }

        // UI güncelle
        loadingBox.style.display = "block";
        resultBox.style.display = "none";

        try {
            const response = await fetch("/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: text,
                    query: "",
                    model: model
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Beklenmeyen bir hata oluştu.");
            }

            // Güvenlik filtresi
            const safe = (v) => v ?? "—";
            
            // Pipeline sonuçlarını UI'ya basıyoruz
            modelOutputs.textContent = JSON.stringify(data.model_outputs || "—", null, 2);
            inputScores.textContent = JSON.stringify(data.input_scores || "—", null, 2);
            outputScores.textContent = JSON.stringify(data.output_scores || "—", null, 2);
            
            // Alignment bilgilerini düzgün formatla
            alignmentScore.textContent = safe(data.alignment);
            
            adviceText.textContent = safe(data.advice);
            rewrittenText.textContent = safe(data.rewritten_text);

            resultBox.style.display = "block";

        } catch (err) {
            alert("Hata: " + err.message);
        }

        loadingBox.style.display = "none";
    }

    analyzeBtn.addEventListener("click", analyze);
});
