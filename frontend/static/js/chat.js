// ---------------------------------------------------------------
// EZA-Core v4.0 – Frontend JS
// API ile iletişim, sonuçların işlenmesi ve ekrana yansıtılması
// ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    const analyzeBtn = document.getElementById("analyzeBtn");
    const userInput = document.getElementById("userInput");
    const modelSelect = document.getElementById("modelSelect");

    const loadingBox = document.getElementById("loading");
    const resultBox = document.getElementById("result");

    const modelOutputs = document.getElementById("modelOutputs");
    const inputScores = document.getElementById("inputScores");
    const outputScores = document.getElementById("outputScores");
    const alignmentScore = document.getElementById("alignmentScore");
    const adviceText = document.getElementById("adviceText");
    const rewrittenText = document.getElementById("rewrittenText");

    // -----------------------------------------
    // ANALİZ ET BUTONU
    // -----------------------------------------
    analyzeBtn.addEventListener("click", async () => {

        const query = userInput.value.trim();
        const model = modelSelect.value;

        if (!query) {
            alert("Lütfen bir metin yazın.");
            return;
        }

        // Loading açılır
        loadingBox.style.display = "block";
        resultBox.style.display = "none";

        try {
            const response = await fetch("/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: query,
                    model: model
                })
            });

            if (!response.ok) {
                throw new Error("Sunucu hatası");
            }

            const data = await response.json();

            // -----------------------------------------
            // EKRANA YAZDIR
            // -----------------------------------------
            modelOutputs.textContent = JSON.stringify(data.model_outputs, null, 2);
            inputScores.textContent = JSON.stringify(data.input_scores, null, 2);
            outputScores.textContent = JSON.stringify(data.output_scores, null, 2);
            alignmentScore.textContent = JSON.stringify(data.alignment_score, null, 2);
            adviceText.textContent = data.advice;
            rewrittenText.textContent = data.rewritten_text;

            // Göster
            resultBox.style.display = "block";

        } catch (err) {
            alert("Bir hata oluştu: " + err.message);
        }

        // Loading kapanır
        loadingBox.style.display = "none";
    });

});
