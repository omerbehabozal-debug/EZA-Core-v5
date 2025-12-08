# Backend Başlatma Rehberi

## Doğru Yöntem

### Yöntem 1: run.py kullanarak (ÖNERİLEN)

```bash
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend
python run.py
```

### Yöntem 2: uvicorn ile doğru modül path

```bash
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**ÖNEMLİ:** `main:app` değil, `backend.main:app` olmalı!

### Yöntem 3: Project root'tan çalıştırma

```bash
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Hata: "Could not import module 'main'"

Bu hata şu durumlarda oluşur:
- Yanlış dizinde çalıştırılıyor
- Modül path yanlış (`main:app` yerine `backend.main:app` olmalı)
- Python path sorunu

## Çözüm

**En kolay yol:** `run.py` kullanın:

```bash
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend
python run.py
```

Bu otomatik olarak doğru path'leri ayarlar.

