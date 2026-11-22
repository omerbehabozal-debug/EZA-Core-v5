"""Yansı V2 Stage 1 security fix — version history, dual hash, media safety, fixtures."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from backend.core.schemas.yansi_v2_publication import CONTRACT_VERSION, WRITER_ASSET_AUTHORITY_RULE
from backend.models.mirror_network import MirrorNetworkNode, YansiPublicationVersionV2
from backend.services.mirror_network import yansi_v2_contract as v2

FIXTURES = json.loads(
    Path(__file__).resolve().parents[2].joinpath('fixtures/yansi_v2_publication_fixtures.json').read_text(
        encoding='utf-8'
    )
)
NODE_ID = FIXTURES['nodeId']


def _image_block():
    return copy.deepcopy(FIXTURES['validImageManifest']['blocks'][0])


def _video_block():
    return copy.deepcopy(FIXTURES['validVideoManifest']['blocks'][0])


def _conversation_block():
    return copy.deepcopy(FIXTURES['validConversationManifest']['blocks'][0])


def test_manifest_and_contract_hash_are_distinct_and_stable():
    manifest = {'blocks': [_image_block()]}
    manifest_hash = v2.compute_manifest_hash(manifest)
    contract_hash = v2.compute_contract_hash(
        node_id=NODE_ID,
        publication_version=1,
        response_policy='open',
        content_kind='image',
        manifest_hash=manifest_hash,
        knowledge_bundle_version_ref=None,
    )
    assert manifest_hash != contract_hash
    assert len(manifest_hash) == 64 and len(contract_hash) == 64
    assert manifest_hash == v2.compute_manifest_hash(manifest)


def test_contract_hash_changes_with_policy_or_bundle():
    manifest_hash = v2.compute_manifest_hash({'blocks': [_image_block()]})
    base = dict(
        node_id=NODE_ID,
        publication_version=1,
        content_kind='image',
        manifest_hash=manifest_hash,
    )
    open_hash = v2.compute_contract_hash(response_policy='open', knowledge_bundle_version_ref=None, **base)
    grounded = v2.compute_contract_hash(
        response_policy='grounded', knowledge_bundle_version_ref='kb-v1', **base
    )
    grounded2 = v2.compute_contract_hash(
        response_policy='grounded', knowledge_bundle_version_ref='kb-v2', **base
    )
    assert open_hash != grounded
    assert grounded != grounded2


def test_single_image_and_video_without_conversation_valid():
    image = v2.build_contract(
        node_id=NODE_ID,
        response_policy='open',
        content_kind='image',
        content_manifest={'blocks': [_image_block()]},
        publication_version=1,
        approval_metadata={'approvedBy': 'owner-1', 'approvedAt': '2026-11-20T00:00:00Z'},
    )
    video = v2.build_contract(
        node_id=NODE_ID,
        response_policy='open',
        content_kind='video',
        content_manifest={'blocks': [_video_block()]},
        publication_version=2,
    )
    assert image['manifestHash'] and image['contractHash']
    assert image['manifestHash'] != image['contractHash']
    assert video['contentManifest']['blocks'][0]['type'] == 'video'


def test_private_media_path_and_unsafe_url_rejected():
    with pytest.raises(v2.YansiV2ContractError) as path_err:
        v2.validate_manifest(FIXTURES['invalidPrivatePathManifest'])
    assert path_err.value.code == 'yansi_v2_private_media_path'

    with pytest.raises(v2.YansiV2ContractError) as url_err:
        v2.validate_manifest(FIXTURES['invalidUnsafeUrlManifest'])
    assert url_err.value.code == 'yansi_v2_unsafe_url'

    with pytest.raises(v2.YansiV2ContractError):
        v2.validate_manifest({
            'blocks': [{
                'type': 'video',
                'assetId': '33333333-3333-3333-3333-333333333333',
                'title': 'Data',
                'href': 'data:text/plain,hi',
            }]
        })


def test_unknown_contract_version_rejected_never_v1():
    with pytest.raises(v2.YansiV2ContractError) as err:
        v2.parse_publication_payload(FIXTURES['invalidUnknownContractVersion'])
    assert err.value.code == 'yansi_v2_unknown_contract_version'
    assert v2.parse_publication_payload({'slug': 'legacy', 'steps': []}) is None


def test_nested_private_keys_rejected():
    polluted = {
        'blocks': [
            {
                **_image_block(),
                'storageKey': 'secret/object',
            }
        ]
    }
    with pytest.raises(v2.YansiV2ContractError) as err:
        v2.validate_manifest(polluted)
    assert err.value.code in {'yansi_v2_private_media_key', 'yansi_v2_invalid_contract', 'yansi_v2_invalid_block'}


def test_writer_asset_authority_rule_documented():
    assert 'authorized' in WRITER_ASSET_AUTHORITY_RULE.lower()
    assert v2.ASSET_AUTHORITY_RULE == WRITER_ASSET_AUTHORITY_RULE


def test_two_versions_preserve_prior_immutable_rows():
    """History is keyed by (node_id, publication_version); pointer is cache-only."""
    first = v2.build_contract(
        node_id=NODE_ID,
        response_policy='open',
        content_kind='image',
        content_manifest={'blocks': [_image_block()]},
        publication_version=1,
    )
    second = v2.build_contract(
        node_id=NODE_ID,
        response_policy='grounded',
        content_kind='mixed',
        content_manifest={'blocks': [_conversation_block(), _image_block()]},
        publication_version=2,
        knowledge_bundle_version_ref='kb-v3',
    )
    store = {}
    for contract in (first, second):
        row = v2.version_row_from_contract(contract)
        key = (row['node_id'], row['publication_version'])
        assert key not in store
        store[key] = copy.deepcopy(row)

    # Non-authoritative pointer moves to v2; v1 row must remain byte-identical.
    current_v2_publication_version = 2
    prior = store[(NODE_ID, 1)]
    assert current_v2_publication_version == 2
    assert prior['response_policy'] == 'open'
    assert prior['contract_hash'] == first['contractHash']
    assert prior['content_manifest'] == first['contentManifest']
    assert prior['manifest_hash'] == first['manifestHash']
    assert store[(NODE_ID, 2)]['knowledge_bundle_version_ref'] == 'kb-v3'
    assert store[(NODE_ID, 2)]['contract_hash'] != prior['contract_hash']

    unique = [
        constraint for constraint in YansiPublicationVersionV2.__table__.constraints
        if getattr(constraint, 'name', None) == 'uq_yansi_publication_versions_v2_node_version'
    ]
    assert unique
    assert [col.name for col in unique[0].columns] == ['node_id', 'publication_version']


def test_node_pointer_is_not_source_of_truth_column():
    assert 'publication_contract' not in MirrorNetworkNode.__table__.c
    assert 'publication_contract_hash' not in MirrorNetworkNode.__table__.c
    assert MirrorNetworkNode.__table__.c.current_v2_publication_version.nullable is True
    assert YansiPublicationVersionV2.__tablename__ == 'yansi_publication_versions_v2'


def test_shared_fixture_image_builds_on_backend():
    contract = v2.build_contract(
        node_id=FIXTURES['nodeId'],
        response_policy='open',
        content_kind='image',
        content_manifest=FIXTURES['validImageManifest'],
        publication_version=1,
    )
    assert contract['contractVersion'] == CONTRACT_VERSION
    assert contract['nodeId'] == FIXTURES['nodeId']
    public = v2.to_public_contract_dto(contract)
    assert 'storageKey' not in json.dumps(public)


def test_alembic_migration_links_to_current_head():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(Path(__file__).resolve().parents[1].joinpath('alembic.ini')))
    script = ScriptDirectory.from_config(config)
    rev = script.get_revision('add_yansi_publication_versions_v2')
    assert rev.down_revision == 'add_business_cover_ai_proposals_v1'
    bundles = script.get_revision('add_yansi_knowledge_bundles_v1')
    assert bundles.down_revision == 'add_yansi_publication_versions_v2'
    drafts = script.get_revision('add_yansi_v2_conversation_drafts_v1')
    assert drafts.down_revision == 'add_yansi_knowledge_bundles_v1'
    kind = script.get_revision('add_studio_kind_v2_prop')
    assert kind.down_revision == 'add_yansi_v2_conversation_drafts_v1'
    assert 'add_studio_kind_v2_prop' in script.get_heads()
