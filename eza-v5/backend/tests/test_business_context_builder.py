"""Context packages from authorized rows. No model call and no live route."""
import json
import uuid

import pytest

from backend.services.business_yansi.context_builder import (
    build_business_context,
    count_tokens,
)

BRAND = uuid.UUID("00000000-0000-0000-0000-0000000000aa")
OTHER = uuid.UUID("00000000-0000-0000-0000-0000000000bb")


def _chunk(business, text, title, version, index=0):
    return {
        "business_id": str(business),
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": str(version),
        "chunk_id": str(uuid.uuid4()),
        "chunk_index": index,
        "title": title,
        "text": text,
    }


async def _allow(db, business_id, rows):
    return {"sources": list(rows), "rejected": [], "reason": None}


def _texts(package):
    found = []
    for document in package["documents"]:
        for section in document["sections"]:
            found.append(section["text"])
    return found


@pytest.mark.asyncio
async def test_wx100_warranty_package_keeps_conditions_and_identity():
    version = uuid.uuid4()
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", version, 0)
    condition = _chunk(BRAND, "Garanti, fatura ibraz edilirse geçerlidir.", "WX-100", version, 1)
    condition["item_id"] = warranty["item_id"]
    package = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[warranty, condition],
    )
    assert package["status"] == "ready"
    assert package["product"] == {"codes": ["WX-100"], "origin": "title"}
    assert package["token_count"] <= package["token_budget"]
    assert package["token_count"] > 0
    assert "Garanti 2 yıldır." in _texts(package)
    assert "fatura ibraz edilirse" in " ".join(_texts(package))
    assert {ref["chunk_id"] for ref in package["source_refs"]} == {warranty["chunk_id"], condition["chunk_id"]}


@pytest.mark.asyncio
async def test_exception_in_another_chunk_stays_with_warranty():
    version = uuid.uuid4()
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", version, 0)
    exception = _chunk(BRAND, "Ticari kullanımda garanti geçerli değildir.", "WX-100", version, 1)
    exception["item_id"] = warranty["item_id"]

    async def load(business_id, version_ids):
        assert str(version) in version_ids
        return [exception]

    package = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[warranty],
        sibling_loader=load,
        authorize_fn=_allow,
    )
    assert package["status"] == "ready"
    assert "Garanti 2 yıldır." in _texts(package)
    assert "geçerli değildir" in " ".join(_texts(package))
    unnamed = _chunk(BRAND, "Ticari kullanımda geçerli değildir.", "WX-100", version, 2)
    unnamed["item_id"] = warranty["item_id"]

    async def load_unnamed(business_id, version_ids):
        return [unnamed]

    kept = await build_business_context(
        "Ticari kullanımda WX-100 garantisi var mı?",
        business_id=BRAND,
        sources=[warranty],
        sibling_loader=load_unnamed,
        authorize_fn=_allow,
    )
    assert kept["status"] == "ready"
    assert "Ticari kullanımda geçerli değildir." in _texts(kept)


@pytest.mark.asyncio
async def test_short_document_is_included_whole():
    version = uuid.uuid4()
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", version, 0)
    color = _chunk(BRAND, "Renk mavidir.", "WX-100", version, 1)
    cloth = _chunk(BRAND, "Kumaşı pamuktur.", "WX-100", version, 2)
    color["item_id"] = cloth["item_id"] = warranty["item_id"]
    package = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[warranty, color, cloth],
        token_budget=2000,
    )
    assert package["status"] == "ready"
    assert set(_texts(package)) == {"Garanti 2 yıldır.", "Renk mavidir.", "Kumaşı pamuktur."}


@pytest.mark.asyncio
async def test_follow_up_uses_server_product_and_drops_the_previous_product_when_named():
    current = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", uuid.uuid4())
    other = _chunk(BRAND, "Garanti 9 yıldır.", "WX-200", uuid.uuid4())
    package = await build_business_context(
        "Garantisi kaç yıl?",
        business_id=BRAND,
        sources=[current, other],
        product_context={"product_code": "WX-100"},
    )
    assert package["status"] == "ready"
    assert package["product"]["codes"] == ["WX-100"]
    assert _texts(package) == ["Garanti 2 yıldır."]
    switched = await build_business_context(
        "WX-200 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[current, other],
        product_context={"product_code": "WX-100"},
    )
    assert switched["status"] == "ready"
    assert switched["product"]["codes"] == ["WX-200"]
    assert _texts(switched) == ["Garanti 9 yıldır."]


@pytest.mark.asyncio
async def test_wrong_product_ambiguous_identity_and_other_tenant_are_left_out():
    wrong = _chunk(BRAND, "Garanti 5 yıldır.", "WX-200", uuid.uuid4())
    price = _chunk(BRAND, "Fiyat 10 TL.", "WX-200", uuid.uuid4())
    for source in (wrong, price):
        package = await build_business_context(
            "WX-100 için bu bilgi nedir?",
            business_id=BRAND,
            sources=[source],
        )
        assert package["status"] == "insufficient"
        assert package["reason"] == "product_mismatch"
        assert package["documents"] == []
        assert "5 yıldır" not in json.dumps(package) and "10 TL" not in json.dumps(package)
    ambiguous = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100 WX-200", uuid.uuid4())
    unresolved = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[ambiguous],
    )
    assert unresolved["status"] == "insufficient"
    assert unresolved["reason"] == "product_unresolved"
    assert unresolved["documents"] == []
    foreign = _chunk(OTHER, "Garanti 5 yıldır.", "WX-100", uuid.uuid4())
    kept = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", uuid.uuid4())
    mixed = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[foreign, kept],
    )
    assert mixed["status"] == "ready"
    assert _texts(mixed) == ["Garanti 2 yıldır."]
    only_foreign = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[foreign],
    )
    assert only_foreign["status"] == "insufficient"
    assert only_foreign["reason"] == "tenant"


@pytest.mark.asyncio
async def test_missing_or_unauthorized_exception_is_not_shipped_alone():
    version = uuid.uuid4()
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", version, 0)
    exception = _chunk(BRAND, "Ticari kullanımda garanti geçerli değildir.", "WX-100", version, 1)
    exception["item_id"] = warranty["item_id"]

    async def load(business_id, version_ids):
        return [exception]

    async def deny(db, business_id, rows):
        return {"sources": [], "rejected": [row["chunk_id"] for row in rows], "reason": None}

    package = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[warranty],
        sibling_loader=load,
        authorize_fn=deny,
    )
    assert package["status"] == "insufficient"
    assert package["reason"] == "missing_condition"
    assert package["documents"] == []
    assert "Garanti 2 yıldır." not in json.dumps(package["documents"])


@pytest.mark.asyncio
async def test_conflicting_warranties_are_not_resolved_by_version_number():
    older = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", uuid.uuid4())
    newer = _chunk(BRAND, "Garanti 5 yıldır.", "WX-100", uuid.uuid4())
    older["knowledge_version"] = 1
    newer["knowledge_version"] = 9
    package = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[older, newer],
    )
    assert package["status"] == "conflict"
    assert package["reason"] == "source_conflict"
    assert package["documents"] == []
    assert package["token_count"] == 0
    assert older["chunk_id"] in package["conflicts"][0]["source_ids"]
    assert newer["chunk_id"] in package["conflicts"][0]["source_ids"]


@pytest.mark.asyncio
async def test_token_budget_keeps_exception_with_warranty_or_sends_nothing():
    version = uuid.uuid4()
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", version, 0)
    exception = _chunk(BRAND, "Ticari kullanımda garanti geçerli değildir.", "WX-100", version, 1)
    exception["item_id"] = warranty["item_id"]
    one = count_tokens(warranty["text"]) + count_tokens("\n")
    assert one is not None
    tight = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[warranty, exception],
        token_budget=one,
    )
    assert tight["status"] == "insufficient"
    assert tight["reason"] == "token_budget"
    assert tight["documents"] == []
    roomy = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[warranty, exception],
        token_budget=2000,
    )
    assert roomy["status"] == "ready"
    assert roomy["token_count"] <= 2000
    emoji = _chunk(BRAND, "WX-100 " + ("😀" * 400), "WX-100", uuid.uuid4())
    overflow = await build_business_context(
        "WX-100 anlat",
        business_id=BRAND,
        sources=[emoji],
        token_budget=20,
    )
    assert count_tokens(emoji["text"]) > 20
    assert overflow["status"] == "insufficient"
    assert overflow["documents"] == []


@pytest.mark.asyncio
async def test_source_wording_for_water_and_install_is_preserved():
    water = _chunk(BRAND, "Su geçirmez.", "WX-100", uuid.uuid4())
    durable = _chunk(BRAND, "Suya dayanıklıdır.", "WX-200", uuid.uuid4())
    package = await build_business_context(
        "WX-100 su geçirmez mi?",
        business_id=BRAND,
        sources=[water, durable],
    )
    assert package["status"] == "ready"
    assert _texts(package) == ["Su geçirmez."]
    install = _chunk(BRAND, "Ücretsiz kurulum yapılmaz.", "WX-100", uuid.uuid4())
    refused = await build_business_context(
        "WX-100 kurulum ücretsiz mi?",
        business_id=BRAND,
        sources=[install],
    )
    assert refused["status"] == "ready"
    assert _texts(refused) == ["Ücretsiz kurulum yapılmaz."]


@pytest.mark.asyncio
async def test_failed_sibling_read_does_not_guess_a_partial_document(monkeypatch):
    async def blocked(db, business_id, version_ids):
        return {"chunks": [], "reason": "flag_off"}

    monkeypatch.setattr(
        "backend.services.business_yansi.context_builder.list_sibling_chunks",
        blocked,
    )
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", uuid.uuid4())
    package = await build_business_context(
        "WX-100 garantisi kaç yıl?",
        business_id=BRAND,
        sources=[warranty],
        db=object(),
    )
    assert package["status"] == "insufficient"
    assert package["reason"] == "sibling_unavailable"
    assert package["documents"] == []
