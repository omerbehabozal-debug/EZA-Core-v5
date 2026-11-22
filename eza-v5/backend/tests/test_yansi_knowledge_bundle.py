"""Yansı V2 Stage 2A — Knowledge Bundle seal, tenancy, digests, publication binding."""
from __future__ import annotations

import copy
import uuid

import pytest

from backend.models.mirror_network import YansiPublicationVersionV2
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.yansi import knowledge_bundle as kb

BIZ = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
OWNER = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
OTHER = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
ASSET = '22222222-2222-2222-2222-222222222222'
KNOWLEDGE = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
OBS = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
NODE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'


def _sources():
    content = 'The workshop fires glaze for daily ceramic use.'
    return {
        'knowledge_versions': {
            KNOWLEDGE: {
                'business_id': BIZ,
                'content': content,
                'version': 3,
                'title': 'Glaze care',
                'public_allowed': False,
            }
        },
        'assets': {
            ASSET: {
                'business_id': BIZ,
                'asset_type': 'image',
                'revision': 2,
                'locator_kind': 'storage',
                'locator': f'business/{BIZ}/image/{ASSET}.png',
                'public_allowed': True,
                'title': 'Kiln',
            }
        },
        'observations': {
            OBS: {
                'business_id': BIZ,
                'asset_id': ASSET,
                'content_sha256': 'a' * 64,
                'analyzer_profile': 'vision-v1',
                'status': 'ready',
            }
        },
    }


def _creator_item(index=0, view=True):
    text = 'Creator note about the kiln schedule.'
    return {
        'index': index,
        'sourceKind': 'creator_text',
        'provenanceType': 'creator',
        'contentDigest': kb.compute_creator_text_digest(text),
        'usageAllowed': True,
        'viewAllowed': view,
        'text': text,
        'title': 'Note',
    }


def _knowledge_item(index=1):
    sources = _sources()
    row = sources['knowledge_versions'][KNOWLEDGE]
    return {
        'index': index,
        'sourceKind': 'knowledge_version',
        'provenanceType': 'business_knowledge',
        'sourceRefId': KNOWLEDGE,
        'knowledgeVersion': row['version'],
        'contentDigest': kb.compute_knowledge_digest(row['content']),
        'usageAllowed': True,
        'viewAllowed': False,
        'title': row['title'],
    }


def _image_item(index=2):
    sources = _sources()
    row = sources['assets'][ASSET]
    return {
        'index': index,
        'sourceKind': 'image_asset',
        'provenanceType': 'brand_asset',
        'sourceRefId': ASSET,
        'contentDigest': kb.compute_asset_digest(
            asset_id=ASSET,
            revision=row['revision'],
            asset_type=row['asset_type'],
            locator_kind=row['locator_kind'],
            locator=row['locator'],
        ),
        'usageAllowed': True,
        'viewAllowed': True,
        'title': row['title'],
    }


def _observation_item(index=3):
    return {
        'index': index,
        'sourceKind': 'media_observation',
        'provenanceType': 'ai_observation',
        'sourceRefId': ASSET,
        'observationId': OBS,
        'analyzerProfile': 'vision-v1',
        'contentDigest': 'a' * 64,
        'usageAllowed': True,
        'viewAllowed': False,
    }


def test_multiple_bundles_and_versions_preserve_prior_hash():
    items_v1 = [_creator_item(0), _image_item(1)]
    sealed_v1, hash_v1 = kb.build_authorized_manifest(
        items_v1, business_id=BIZ, owner_user_id=OWNER, sources=_sources()
    )
    items_v2 = sealed_v1 + [_knowledge_item(2)]
    # reindex
    for index, item in enumerate(items_v2):
        item['index'] = index
    sealed_v2, hash_v2 = kb.build_authorized_manifest(
        items_v2, business_id=BIZ, owner_user_id=OWNER, sources=_sources()
    )
    assert hash_v1 != hash_v2
    assert hash_v1 == kb.compute_bundle_hash(sealed_v1)
    # Prior snapshot unchanged
    assert sealed_v1[0]['contentDigest'] == items_v1[0]['contentDigest']

    bundle_a = str(uuid.uuid4())
    bundle_b = str(uuid.uuid4())
    assert bundle_a != bundle_b
    assert kb.next_version_number([]) == 1
    assert kb.next_version_number([1, 2]) == 3


def test_foreign_tenant_source_rejected():
    item = _knowledge_item()
    sources = _sources()
    sources['knowledge_versions'][KNOWLEDGE]['business_id'] = OTHER
    with pytest.raises(kb.KnowledgeBundleError) as err:
        kb.build_authorized_manifest(
            [_creator_item(), item],
            business_id=BIZ,
            owner_user_id=OWNER,
            sources=sources,
        )
    assert err.value.code == 'bundle_foreign_source'


def test_asset_digest_mismatch_rejected():
    item = _image_item(1)
    item['contentDigest'] = '0' * 64
    with pytest.raises(kb.KnowledgeBundleError) as err:
        kb.build_authorized_manifest(
            [_creator_item(0), item],
            business_id=BIZ,
            owner_user_id=OWNER,
            sources=_sources(),
        )
    assert err.value.code == 'bundle_digest_mismatch'


def test_ai_observation_provenance_required():
    items, bundle_hash = kb.build_authorized_manifest(
        [_creator_item(), _image_item(1), _observation_item(2)],
        business_id=BIZ,
        owner_user_id=OWNER,
        sources=_sources(),
    )
    assert items[2]['provenanceType'] == 'ai_observation'
    assert items[2]['analyzerProfile'] == 'vision-v1'
    assert bundle_hash == kb.compute_bundle_hash(items)

    bad = _observation_item(2)
    bad['analyzerProfile'] = 'other'
    with pytest.raises(kb.KnowledgeBundleError) as err:
        kb.build_authorized_manifest(
            [_creator_item(), _image_item(1), bad],
            business_id=BIZ,
            owner_user_id=OWNER,
            sources=_sources(),
        )
    assert err.value.code == 'bundle_provenance_invalid'


def test_bundle_immutability_and_public_dto_strips_secrets():
    items, bundle_hash = kb.build_authorized_manifest(
        [_creator_item(view=False), _knowledge_item(1), _image_item(2)],
        business_id=BIZ,
        owner_user_id=OWNER,
        sources=_sources(),
    )
    kb.assert_draft_mutable('draft')
    with pytest.raises(kb.KnowledgeBundleError) as err:
        kb.assert_draft_mutable('sealed')
    assert err.value.code == 'bundle_immutable'

    envelope = kb.seal_version_payload(
        bundle_id=str(uuid.uuid4()),
        bundle_version_id=str(uuid.uuid4()),
        version=1,
        access_scope='business',
        items=items,
        bundle_hash=bundle_hash,
        business_id=BIZ,
        owner_user_id=OWNER,
        approved_by=OWNER,
    )
    public = kb.to_public_bundle_dto(envelope)
    blob = str(public)
    assert 'locator' not in blob
    assert 'storage' not in blob.lower() or 'storageKey' not in blob
    # Private creator text and knowledge body must not appear.
    assert 'Creator note about the kiln schedule.' not in blob
    assert 'The workshop fires glaze' not in blob
    assert public['items'][2]['viewAllowed'] is True


def test_grounded_requires_sealed_bundle_open_does_not():
    items, bundle_hash = kb.build_authorized_manifest(
        [_creator_item(), _image_item(1)],
        business_id=BIZ,
        owner_user_id=OWNER,
        sources=_sources(),
    )
    version_id = str(uuid.uuid4())
    sealed = {
        'id': version_id,
        'status': 'sealed',
        'bundle_hash': bundle_hash,
    }
    kb.assert_publication_bundle_binding(
        response_policy='open',
        knowledge_bundle_version_ref=None,
        bundle_version=None,
    )
    with pytest.raises(kb.KnowledgeBundleError) as missing:
        kb.assert_publication_bundle_binding(
            response_policy='grounded',
            knowledge_bundle_version_ref=None,
            bundle_version=None,
        )
    assert missing.value.code == 'bundle_required_for_grounded'

    kb.assert_publication_bundle_binding(
        response_policy='grounded',
        knowledge_bundle_version_ref=version_id,
        bundle_version=sealed,
    )
    with pytest.raises(kb.KnowledgeBundleError) as draft:
        kb.assert_publication_bundle_binding(
            response_policy='grounded',
            knowledge_bundle_version_ref=version_id,
            bundle_version={**sealed, 'status': 'draft'},
        )
    assert draft.value.code == 'bundle_not_sealed'

    # Contract hash still includes bundle ref.
    image_path = (
        '/api/business-yansi/public-media/'
        '11111111-1111-1111-1111-111111111111/'
        f'{ASSET}'
    )
    contract = pub.build_contract(
        node_id=NODE,
        response_policy='grounded',
        content_kind='image',
        content_manifest={
            'blocks': [{
                'type': 'image',
                'assetId': ASSET,
                'title': 'Kiln',
                'contentPath': image_path,
            }]
        },
        publication_version=1,
        knowledge_bundle_version_ref=version_id,
    )
    other = pub.build_contract(
        node_id=NODE,
        response_policy='grounded',
        content_kind='image',
        content_manifest=contract['contentManifest'],
        publication_version=1,
        knowledge_bundle_version_ref=str(uuid.uuid4()),
    )
    assert contract['contractHash'] != other['contractHash']
    assert contract['knowledgeBundleVersionRef'] == version_id


def test_new_version_copies_prior_items():
    items, _ = kb.build_authorized_manifest(
        [_creator_item(), _image_item(1)],
        business_id=BIZ,
        owner_user_id=OWNER,
        sources=_sources(),
    )
    copied = kb.copy_items_for_new_version(items)
    assert copied == items
    copied[0]['title'] = 'mutated'
    assert items[0]['title'] != 'mutated'


def test_orm_unique_and_publication_fk_present():
    assert YansiKnowledgeBundle.__tablename__ == 'yansi_knowledge_bundles'
    assert YansiKnowledgeBundleVersion.__tablename__ == 'yansi_knowledge_bundle_versions'
    unique = [
        c for c in YansiKnowledgeBundleVersion.__table__.constraints
        if getattr(c, 'name', None) == 'uq_yansi_knowledge_bundle_versions_bundle_version'
    ]
    assert unique
    assert 'knowledge_bundle_version_id' in YansiPublicationVersionV2.__table__.c


def test_alembic_migration_chains_from_publication_v2():
    from pathlib import Path
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(Path(__file__).resolve().parents[1].joinpath('alembic.ini')))
    script = ScriptDirectory.from_config(config)
    rev = script.get_revision('add_yansi_knowledge_bundles_v1')
    assert rev.down_revision == 'add_yansi_publication_versions_v2'
    assert 'add_yansi_knowledge_bundles_v1' in script.get_heads()
