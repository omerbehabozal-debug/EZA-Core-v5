"""Public BiligN chat and Yansı stay on OpenAI when an old model id arrives."""
import json
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.llm.providers.groq_client import GroqClient
from backend.core.llm.providers.mistral_client import MistralClient
from backend.core.utils.model_router import PUBLIC_CHAT_MODEL_ID, ModelRouter, coerce_public_chat_model
from backend.services.business_yansi.answers import BusinessHistory, answer


def test_retired_and_empty_public_models_become_openai():
    assert coerce_public_chat_model(None) == PUBLIC_CHAT_MODEL_ID
    assert coerce_public_chat_model("  ") == PUBLIC_CHAT_MODEL_ID
    assert coerce_public_chat_model("groq/llama3-8b-tool-use") == PUBLIC_CHAT_MODEL_ID
    assert coerce_public_chat_model("mistral/mistral-7b-instruct") == PUBLIC_CHAT_MODEL_ID
    assert coerce_public_chat_model("groq-llama3-70b") == PUBLIC_CHAT_MODEL_ID
    assert coerce_public_chat_model("openai/gpt-4o-mini") == "openai/gpt-4o-mini"
    assert coerce_public_chat_model("openai/gpt-4.1-mini") == "openai/gpt-4.1-mini"


@pytest.mark.asyncio
async def test_router_does_not_call_retired_providers_for_public_chat():
    router = ModelRouter()
    if PUBLIC_CHAT_MODEL_ID not in router.available_models:
        router.available_models.append(PUBLIC_CHAT_MODEL_ID)
    router.groq_client.generate = AsyncMock(side_effect=AssertionError("groq"))
    router.mistral_client.generate = AsyncMock(side_effect=AssertionError("mistral"))
    router.openai_client.generate = AsyncMock(
        return_value={"ok": True, "output": "cevap", "provider": "openai"}
    )
    for retired in ("groq/llama3-8b-tool-use", "mistral/mistral-7b-instruct", None):
        result = await router.generate(
            prompt="Merhaba",
            model_id=coerce_public_chat_model(retired),
            retries=0,
        )
        assert result["provider"] == "openai"
        assert router.openai_client.generate.await_args.kwargs["model"] == "gpt-4o-mini"
    router.groq_client.generate.assert_not_called()
    router.mistral_client.generate.assert_not_called()


@pytest.mark.asyncio
async def test_standalone_pipeline_skips_ensemble_for_empty_and_retired_models():
    from backend.api.pipeline_runner import run_full_pipeline

    generate = AsyncMock(return_value={"ok": True, "output": "cevap", "provider": "openai"})
    route = AsyncMock(side_effect=AssertionError("ensemble"))
    with patch("backend.api.pipeline_runner.ModelRouter") as router_cls, patch.object(
        GroqClient, "generate", AsyncMock(side_effect=AssertionError("groq"))
    ), patch.object(MistralClient, "generate", AsyncMock(side_effect=AssertionError("mistral"))):
        router_cls.return_value.generate = generate
        router_cls.return_value.route_by_mode = route
        for model in ("groq/llama3-8b-tool-use", "mistral/mistral-7b-instruct", None):
            result = await run_full_pipeline(
                user_input="Merhaba", mode="standalone", analysis_model=model
            )
            assert result["ok"] is True
    assert {call.kwargs["model_id"] for call in generate.await_args_list} == {PUBLIC_CHAT_MODEL_ID}
    route.assert_not_called()


@pytest.mark.asyncio
async def test_yansi_retired_model_is_sent_to_openai_provider():
    sources = [{"id": "a", "title": "Yansı", "text": "Yansı bir deneyimdir.", "source": "Ürün", "version": 1}]
    history = BusinessHistory([], "tenant-a", sources)
    provider = AsyncMock(
        return_value={
            "ok": True,
            "output": json.dumps({"quotes": [{"sourceId": "a", "quote": "Yansı bir deneyimdir."}]}),
        }
    )
    groq = AsyncMock(side_effect=AssertionError("groq"))
    mistral = AsyncMock(side_effect=AssertionError("mistral"))
    with patch.object(GroqClient, "generate", groq), patch.object(MistralClient, "generate", mistral):
        result = await answer(
            "Yansı nedir?", history, model="groq/llama3-8b-tool-use", provider=provider
        )
    assert "Kaynak:" in result["assistant_answer"]
    assert provider.await_args.kwargs["model_id"] == PUBLIC_CHAT_MODEL_ID
    groq.assert_not_called()
    mistral.assert_not_called()
