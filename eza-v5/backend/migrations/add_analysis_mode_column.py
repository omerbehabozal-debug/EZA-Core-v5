# -*- coding: utf-8 -*-
"""
Migration: Add analysis_mode column to production_organizations table

This migration adds the analysis_mode column to support FAST vs PRO dual analysis modes.
"""

import asyncio
import logging
from sqlalchemy import text
from backend.core.utils.dependencies import engine

logger = logging.getLogger(__name__)


async def add_analysis_mode_column():
    """
    Add analysis_mode column to production_organizations table
    
    Column: analysis_mode VARCHAR(20) NOT NULL DEFAULT 'fast'
    """
    async with engine.begin() as conn:
        try:
            # Check if column already exists
            check_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_organizations' 
                AND column_name = 'analysis_mode'
            """))
            
            if check_result.scalar_one_or_none():
                logger.info("Column 'analysis_mode' already exists in production_organizations table")
                return
            
            # Add analysis_mode column
            await conn.execute(text("""
                ALTER TABLE production_organizations 
                ADD COLUMN analysis_mode VARCHAR(20) NOT NULL DEFAULT 'fast'
            """))
            
            logger.info("✓ Added analysis_mode column to production_organizations table")
            
        except Exception as e:
            logger.error(f"Error adding analysis_mode column: {e}")
            raise


async def main():
    """Run migration"""
    logging.basicConfig(level=logging.INFO)
    await add_analysis_mode_column()
    logger.info("Migration completed successfully")


if __name__ == "__main__":
    asyncio.run(main())

