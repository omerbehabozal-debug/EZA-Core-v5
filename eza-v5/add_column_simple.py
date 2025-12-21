"""
Simple script to add input_content column to Railway PostgreSQL
Run from eza-v5 directory: python add_column_simple.py
"""
import asyncio
import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Railway connection string (from environment or hardcoded for this script)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:EZEGyZxrJgJPlTzfSQXOYYYDbYNcUbON@hopper.proxy.rlwy.net:37882/railway"
)

# Convert to asyncpg format if needed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


async def add_column():
    """Add input_content column"""
    print("=" * 60)
    print("EZA - input_content Kolonu Ekleme")
    print("=" * 60)
    print()
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        try:
            # Check if column exists
            print("Kolon kontrol ediliyor...")
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_intent_logs' 
                AND column_name = 'input_content'
            """))
            exists = result.scalar_one_or_none() is not None
            
            if exists:
                print("✅ input_content kolonu zaten mevcut!")
                return
            
            # Add column
            print("input_content kolonu ekleniyor...")
            await conn.execute(text("""
                ALTER TABLE production_intent_logs 
                ADD COLUMN input_content TEXT
            """))
            
            # Add comment
            await conn.execute(text("""
                COMMENT ON COLUMN production_intent_logs.input_content 
                IS 'Full original text analyzed (for snapshot viewing)'
            """))
            
            print("✅ input_content kolonu başarıyla eklendi!")
            
            # Verify
            verify = await conn.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'production_intent_logs' 
                AND column_name = 'input_content'
            """))
            row = verify.fetchone()
            if row:
                print(f"✅ Doğrulama: {row[0]} ({row[1]}) kolonu mevcut")
            
        except Exception as e:
            print(f"❌ Hata: {e}")
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(add_column())
        print()
        print("✅ İşlem tamamlandı!")
    except Exception as e:
        print()
        print(f"❌ Hata: {e}")
        import traceback
        traceback.print_exc()

