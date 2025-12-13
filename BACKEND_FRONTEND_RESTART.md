# Backend ve Frontend Yeniden Başlatma Komutları

## Backend'i Başlatma

**Yeni terminal penceresi açın ve:**

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend
python run.py
```

**VEYA:**

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend'i Başlatma

**Yeni terminal penceresi açın ve:**

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\frontend
npm run dev
```

## Önemli Notlar

- Backend ve Frontend **ayrı terminal pencerelerinde** çalıştırılmalı
- Backend önce başlatılmalı
- Her ikisi de çalışırken terminal pencerelerini kapatmayın

## Hızlı Kontrol

Backend çalışıyor mu?
- Tarayıcıda: http://localhost:8000/docs

Frontend çalışıyor mu?
- Tarayıcıda: http://localhost:3008/standalone (veya hangi port kullanıyorsanız)

