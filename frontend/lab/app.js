/**
 * EZA LAB Dashboard - Frontend Application
 */

async function analyze() {
    const text = document.getElementById("input").value;
    const outputElement = document.getElementById("output");
    
    if (!text.trim()) {
        outputElement.innerText = "Lütfen analiz etmek için bir metin girin.";
        return;
    }
    
    // Show loading state
    outputElement.innerText = "Analiz ediliyor...";
    
    try {
        const res = await fetch("/analyze", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ text })
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        outputElement.innerText = JSON.stringify(data, null, 2);
    } catch (error) {
        outputElement.innerText = `Hata: ${error.message}`;
        console.error("Analysis error:", error);
    }
}

// Allow Enter key to trigger analysis (Ctrl+Enter)
document.getElementById("input").addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.key === "Enter") {
        analyze();
    }
});

