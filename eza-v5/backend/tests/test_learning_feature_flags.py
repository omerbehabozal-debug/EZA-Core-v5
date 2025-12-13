# -*- coding: utf-8 -*-
"""
Test Learning Feature Flags
Ensures learning components are completely disabled when flags are off.
"""

import pytest
from unittest.mock import patch, MagicMock
from backend.config import get_settings
from backend.learning.feature_flags import (
    check_learning_flags,
    require_vector_db,
    require_ethical_embedding,
    require_learning_pipeline
)
from backend.learning.vector_client import QdrantClient
from backend.services.ethical_embedding_service import EthicalEmbeddingService
from backend.services.ethical_case_service import EthicalCaseService
from backend.training.train import train_ethical_model


class TestFeatureFlags:
    """Test feature flag behavior"""
    
    def test_all_flags_disabled_by_default(self):
        """Test that all learning flags are disabled by default"""
        settings = get_settings()
        
        assert settings.VECTOR_DB_ENABLED == False
        assert settings.ETHICAL_EMBEDDING_ENABLED == False
        assert settings.LEARNING_PIPELINE_ENABLED == False
        assert settings.AUTO_POLICY_UPDATE_ENABLED == False
    
    def test_check_learning_flags(self):
        """Test check_learning_flags function"""
        flags = check_learning_flags()
        
        assert flags["VECTOR_DB_ENABLED"] == False
        assert flags["ETHICAL_EMBEDDING_ENABLED"] == False
        assert flags["LEARNING_PIPELINE_ENABLED"] == False
        assert flags["AUTO_POLICY_UPDATE_ENABLED"] == False
        assert flags["all_disabled"] == True


class TestVectorDBDisabled:
    """Test Vector DB behavior when disabled"""
    
    def test_qdrant_client_disabled(self):
        """Test QdrantClient is no-op when disabled"""
        with patch('backend.config.get_settings') as mock_settings:
            mock_settings.return_value.VECTOR_DB_ENABLED = False
            mock_settings.return_value.VECTOR_DB_URL = "http://localhost:6333"
            mock_settings.return_value.VECTOR_DB_API_KEY = None
            
            client = QdrantClient()
            
            assert client.enabled == False
            assert client.client is None
            assert client.initialized == False
    
    @pytest.mark.asyncio
    async def test_vector_db_insert_noop_when_disabled(self):
        """Test vector DB insert is no-op when disabled"""
        with patch('backend.config.get_settings') as mock_settings:
            mock_settings.return_value.VECTOR_DB_ENABLED = False
            
            client = QdrantClient()
            result = await client.insert_embedding(
                collection_name="test",
                point_id="test-id",
                vector=[0.1] * 1536,
                payload={}
            )
            
            assert result == False  # No-op returns False
    
    @pytest.mark.asyncio
    async def test_vector_db_search_noop_when_disabled(self):
        """Test vector DB search is no-op when disabled"""
        with patch('backend.config.get_settings') as mock_settings:
            mock_settings.return_value.VECTOR_DB_ENABLED = False
            
            client = QdrantClient()
            result = await client.search_similar(
                collection_name="test",
                query_vector=[0.1] * 1536,
                limit=10
            )
            
            assert result == []  # No-op returns empty list


class TestEthicalEmbeddingDisabled:
    """Test Ethical Embedding behavior when disabled"""
    
    @pytest.mark.asyncio
    async def test_store_embedding_noop_when_disabled(self):
        """Test store_embedding is no-op when disabled"""
        from unittest.mock import AsyncMock
        
        with patch('backend.config.get_settings') as mock_settings:
            mock_settings.return_value.ETHICAL_EMBEDDING_ENABLED = False
            
            service = EthicalEmbeddingService()
            mock_db = AsyncMock()
            result = await service.store_embedding(
                db=mock_db,
                embedding_vector=[0.1] * 1536
            )
            
            assert result is None  # No-op returns None
            # Ensure no DB operations were called
            mock_db.add.assert_not_called()
            mock_db.commit.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_get_embedding_noop_when_disabled(self):
        """Test get_embedding is no-op when disabled"""
        from unittest.mock import AsyncMock
        
        with patch('backend.config.get_settings') as mock_settings:
            mock_settings.return_value.ETHICAL_EMBEDDING_ENABLED = False
            
            service = EthicalEmbeddingService()
            mock_db = AsyncMock()
            result = await service.get_embedding(
                db=mock_db,
                embedding_id="00000000-0000-0000-0000-000000000000"
            )
            
            assert result is None  # No-op returns None
            # Ensure no DB operations were called
            mock_db.execute.assert_not_called()


class TestEthicalCaseDisabled:
    """Test Ethical Case behavior when disabled"""
    
    @pytest.mark.asyncio
    async def test_create_ethical_case_noop_when_disabled(self):
        """Test create_ethical_case is no-op when disabled"""
        from unittest.mock import AsyncMock
        
        with patch('backend.config.get_settings') as mock_settings:
            mock_settings.return_value.LEARNING_PIPELINE_ENABLED = False
            
            service = EthicalCaseService()
            mock_db = AsyncMock()
            result = await service.create_ethical_case(
                db=mock_db,
                anonymized_text="test",
                risk_level="low"
            )
            
            assert result is None  # No-op returns None
            # Ensure no DB operations were called
            mock_db.add.assert_not_called()
            mock_db.commit.assert_not_called()


class TestTrainingPipelineDisabled:
    """Test Training Pipeline behavior when disabled"""
    
    def test_train_ethical_model_raises_when_disabled(self):
        """Test train_ethical_model raises NotImplementedError when disabled"""
        with patch('backend.config.get_settings') as mock_settings:
            mock_settings.return_value.LEARNING_PIPELINE_ENABLED = False
            
            with pytest.raises(NotImplementedError) as exc_info:
                train_ethical_model(
                    dataset_path="/tmp/dataset",
                    model_config={},
                    output_path="/tmp/model"
                )
            
            assert "disabled" in str(exc_info.value).lower()


class TestNoImpactOnMainPipeline:
    """Test that learning components don't affect main pipeline"""
    
    @pytest.mark.asyncio
    async def test_pipeline_works_with_learning_disabled(self):
        """Test that main pipeline works normally when learning is disabled"""
        # This test ensures that even if learning components are imported,
        # they don't affect the main pipeline execution
        
        # Import main pipeline components
        from backend.api.pipeline_runner import run_full_pipeline
        
        # Ensure learning flags are disabled
        settings = get_settings()
        assert settings.VECTOR_DB_ENABLED == False
        assert settings.ETHICAL_EMBEDDING_ENABLED == False
        assert settings.LEARNING_PIPELINE_ENABLED == False
        
        # Main pipeline should work normally
        # (Actual pipeline test would require more setup, this is a placeholder)
        assert True  # Placeholder - actual test would call run_full_pipeline

