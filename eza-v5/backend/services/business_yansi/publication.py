"""Business approval attaches to a real sealed Yansı; never fabricate a seal."""
import os
import uuid
from sqlalchemy import select
from .service import access, uid, fail, draft_row, published_knowledge
from backend.models.business_yansi import BusinessPublication, BusinessProfile
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation, StandaloneConversationMessage

def enabled(): return os.getenv('BILIGN_BUSINESS_ENABLED','false').lower()=='true'

def publisher(profile):
    return {'businessId':str(profile.id),'slug':profile.slug,'displayName':profile.name,'logoUrl':profile.logo_url,'verified':bool(profile.verified),'official':bool(profile.official)}

async def public_publisher(db,slug,version):
    if not enabled(): return None
    link=await db.get(BusinessPublication,(slug,int(version)))
    if not link: return None
    profile=await db.get(BusinessProfile,link.business_id)
    from backend.models.production import Organization
    organization=await db.get(Organization,link.business_id)
    # Identity follows the brand even when verification is later revoked.
    # The verified flag only controls the public badge, not the publisher name.
    if not profile or profile.status!='active' or not organization or organization.status!='active': fail('business_unavailable',404)
    return publisher(profile)

async def export_editorial_conversation(db,business_id,user_id,draft_id):
    await access(db,business_id,user_id,'editor')
    draft=await draft_row(db,business_id,draft_id,True)
    if draft.created_by!=uid(user_id): fail('editorial_conversation_owner_required')
    if draft.status!='approved': fail('draft_approval_required',409)
    if draft.conversation_id:
        conversation=await db.get(StandaloneConversation,draft.conversation_id)
        return conversation.client_conversation_id
    # An editorial conversation contains only approved public-source Q/A, never
    # customer conversation text. Existing Ayna/preparation/seal APIs own generation.
    conversation=StandaloneConversation(id=uuid.uuid4(),user_id=uid(user_id),client_conversation_id=str(uuid.uuid4()),title=draft.title,preview=draft.summary,conversation_type='direct',message_count=16,tree_metadata={})
    db.add(conversation);await db.flush()
    for index,step in enumerate(draft.steps):
        for offset,(role,key) in enumerate((('user','question'),('assistant','answer'))):
            db.add(StandaloneConversationMessage(conversation_id=conversation.id,client_message_id=str(uuid.uuid4()),role=role,content=step[key],sequence=index*2+offset+1))
    draft.conversation_id=conversation.id
    await db.commit();return conversation.client_conversation_id

async def publish_draft(db,business_id,user_id,draft_id,slug,revision):
    business=await access(db,business_id,user_id,'owner')
    if not business.verified: fail('business_verification_required',409)
    await db.scalar(select(BusinessProfile).where(BusinessProfile.id==uid(business_id)).with_for_update())
    draft=await draft_row(db,business_id,draft_id,True)
    if draft.revision!=revision or draft.status!='approved' or not draft.approved_by or not draft.conversation_id: fail('approved_editorial_source_required',409)
    if len(await published_knowledge(db,business_id,draft.knowledge_snapshot))!=len(draft.knowledge_snapshot): fail('source_snapshot_unavailable',409)
    node=await db.scalar(select(MirrorNetworkNode).where(MirrorNetworkNode.slug==slug).with_for_update())
    conversation=await db.get(StandaloneConversation,draft.conversation_id)
    if not node or node.user_id!=draft.created_by or str(node.conversation_id) not in {str(conversation.id),conversation.client_conversation_id} or node.visibility!='private' or node.safety_status!='open': fail('private_owned_yansi_required',409)
    from backend.services.mirror_network.frozen_journey_artifact import get_frozen_journey_artifact, to_public_frozen_journey_artifact
    internal=await get_frozen_journey_artifact(db,slug=slug,journey_version=node.journey_version)
    frozen=to_public_frozen_journey_artifact(internal) if internal else None
    expected=[(s['question'],s['answer']) for s in draft.steps]
    if not frozen or len(frozen['steps'])!=8 or [(s['publicQuestion'],s['publicAnswer']) for s in frozen['steps']]!=expected: fail('sealed_draft_mismatch',409)
    if await db.get(BusinessPublication,(slug,node.journey_version)): fail('publication_already_bound',409)
    db.add(BusinessPublication(slug=slug,journey_version=node.journey_version,business_id=uid(business_id),draft_id=draft.id,knowledge_snapshot=draft.knowledge_snapshot,published_by=uid(user_id)))
    node.visibility='public';draft.status='published';draft.revision+=1
    await db.commit();return node
