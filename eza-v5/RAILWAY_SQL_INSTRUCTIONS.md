# Railway PostgreSQL - input_content Kolonu Ekleme

## Yöntem 1: Railway Dashboard (Önerilen - En Kolay)

1. **Railway Dashboard'a gidin**: https://railway.app
2. **Projenizi seçin**: EZA-Core-v5 veya ilgili proje
3. **PostgreSQL servisini bulun** ve tıklayın
4. **"Data" veya "Query" sekmesine** gidin
5. **Query Editor'da** aşağıdaki SQL'i yapıştırın ve **"Run"** butonuna tıklayın:

```sql
ALTER TABLE production_intent_logs 
ADD COLUMN IF NOT EXISTS input_content TEXT;

COMMENT ON COLUMN production_intent_logs.input_content IS 'Full original text analyzed (for snapshot viewing)';
```

6. **"Success" mesajını** görmelisiniz.

---

## Yöntem 2: Railway CLI (Terminal)

Eğer Railway CLI kuruluysa:

```bash
# Railway'e login olun
railway login

# Projenizi seçin
railway link

# PostgreSQL'e bağlanın ve SQL çalıştırın
railway connect postgres
```

Sonra PostgreSQL prompt'unda:

```sql
ALTER TABLE production_intent_logs 
ADD COLUMN IF NOT EXISTS input_content TEXT;

COMMENT ON COLUMN production_intent_logs.input_content IS 'Full original text analyzed (for snapshot viewing)';
```

---

## Yöntem 3: psql ile Doğrudan Bağlantı

1. **Railway Dashboard'dan** PostgreSQL connection string'i alın:
   - PostgreSQL servisi → "Variables" sekmesi
   - `DATABASE_URL` veya `POSTGRES_URL` değişkenini kopyalayın

2. **Terminal'de** psql ile bağlanın:

```bash
# Windows PowerShell'de:
psql "postgresql://user:password@host:port/database"

# Veya Railway'in sağladığı connection string'i kullanın
```

3. **SQL'i çalıştırın**:

```sql
ALTER TABLE production_intent_logs 
ADD COLUMN IF NOT EXISTS input_content TEXT;

COMMENT ON COLUMN production_intent_logs.input_content IS 'Full original text analyzed (for snapshot viewing)';
```

---

## Yöntem 4: Python Script ile (Backend'den)

Backend'den doğrudan çalıştırabilirsiniz:

```python
# backend/scripts/add_column.py
import asyncio
from sqlalchemy import text
from backend.core.utils.dependencies import AsyncSessionLocal

async def add_input_content_column():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("""
                ALTER TABLE production_intent_logs 
                ADD COLUMN IF NOT EXISTS input_content TEXT;
            """))
            await db.commit()
            print("✅ input_content kolonu başarıyla eklendi!")
        except Exception as e:
            print(f"❌ Hata: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(add_input_content_column())
```

Çalıştırma:
```bash
cd eza-v5/backend
python scripts/add_column.py
```

---

## Doğrulama

Kolonun eklendiğini kontrol etmek için:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'production_intent_logs' 
AND column_name = 'input_content';
```

Bu sorgu bir satır döndürmelidir.

---

## Notlar

- `IF NOT EXISTS` kullanıldığı için kolon zaten varsa hata vermez
- Kolon `TEXT` tipinde, sınırsız uzunlukta metin saklayabilir
- Mevcut kayıtlar için `input_content` NULL olacak (normal)
- Yeni kayıtlar için backend otomatik olarak içeriği bu kolona yazacak

