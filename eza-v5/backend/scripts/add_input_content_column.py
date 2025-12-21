"""
Add input_content column to production_intent_logs table
Run this script to add the column if it doesn't exist.

Usage:
    From eza-v5 directory:
    python -m backend.scripts.add_input_content_column
    
    Or from backend directory:
    python scripts/add_input_content_column.py
"""
import asyncio
import sys
import os

# Get the project root (eza-v5 directory)
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)

# Add project root to Python path
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy import text
from backend.core.utils.dependencies import AsyncSessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def add_input_content_column():
    """Add input_content column to production_intent_logs table"""
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Checking if input_content column exists...")
            
            # Check if column exists
            check_result = await db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_intent_logs' 
                AND column_name = 'input_content'
            """))
            column_exists = check_result.scalar_one_or_none() is not None
            
            if column_exists:
                logger.info("✅ input_content kolonu zaten mevcut!")
                return
            
            logger.info("Adding input_content column...")
            
            # Add column
            await db.execute(text("""
                ALTER TABLE production_intent_logs 
                ADD COLUMN input_content TEXT
            """))
            
            # Add comment
            await db.execute(text("""
                COMMENT ON COLUMN production_intent_logs.input_content IS 'Full original text analyzed (for snapshot viewing)'
            """))
            
            await db.commit()
            logger.info("✅ input_content kolonu başarıyla eklendi!")
            
            # Verify
            verify_result = await db.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'production_intent_logs' 
                AND column_name = 'input_content'
            """))
            verify = verify_result.fetchone()
            if verify:
                logger.info(f"✅ Doğrulama: {verify[0]} ({verify[1]}) kolonu mevcut")
            
        except Exception as e:
            logger.error(f"❌ Hata: {e}", exc_info=True)
            await db.rollback()
            raise


if __name__ == "__main__":
    print("=" * 60)
    print("EZA - input_content Kolonu Ekleme Script'i")
    print("=" * 60)
    print()
    
    try:
        asyncio.run(add_input_content_column())
        print()
        print("✅ İşlem tamamlandı!")
    except Exception as e:
        print()
        print(f"❌ Hata: {e}")
        sys.exit(1)

