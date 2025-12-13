# Backend Çalıştırma Kılavuzu

## ✅ Doğru Yöntem (PowerShell)

### Yöntem 1: run.py kullan (ÖNERİLEN)
```powershell
# Project root'tan (eza-v5/)
cd "C:\Users\MONSTER\EZA-Core-v4.0\eza-v5"
python backend/run.py
```

### Yöntem 2: Backend klasöründen run.py
```powershell
# Backend klasöründen
cd "C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend"
python run.py
```

### Yöntem 3: Uvicorn direkt (Project root'tan)
```powershell
# Project root'tan (eza-v5/)
cd "C:\Users\MONSTER\EZA-Core-v4.0\eza-v5"
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

## ❌ YANLIŞ Yöntemler (Hata Verir)

```powershell
# ❌ YANLIŞ - cd komutu eksik
C:\Users\MONSTER\EZA-Core-v4.0\eza-v5  # Hata: "is not recognized as a cmdlet"

# ❌ YANLIŞ - backend/ klasöründen uvicorn
cd backend
uvicorn main:app  # ❌ "Could not import module 'main'" hatası

# ❌ YANLIŞ - backend/ klasöründen
cd backend
python -m uvicorn main:app  # ❌ Hata verir
```

## PowerShell Notları

- **Her zaman `cd` komutu kullan**: Dizine geçmek için `cd "path"` kullanın
- **Path'leri tırnak içine alın**: Boşluk veya özel karakter varsa `"path"` kullanın
- **Çalışma dizini önemli**: Uvicorn komutunu çalıştırmadan önce doğru dizinde olduğunuzdan emin olun

## Neden?

- `main.py` dosyası `backend/` klasöründe
- Import'lar `backend.` prefix'i ile yapılıyor
- Python path'e project root eklenmeli
- Uvicorn modül yolunu `backend.main:app` olarak görmeli

## Çözüm

Her zaman **project root'tan** (`eza-v5/`) çalıştır:
- ✅ `python backend/run.py`
- ✅ `uvicorn backend.main:app --reload`

