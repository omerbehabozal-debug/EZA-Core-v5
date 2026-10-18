"""Studio Phase 1: persisted admission, explicit unavailable executor."""
from uuid import UUID
import os
from fastapi import APIRouter, Depends, HTTPException

from backend.auth.deps import get_current_user
from backend.core.utils.dependencies import get_db
from backend.core.schemas.business_studio import TopicsRequest, GenerationRequest, GenerationResponse
from backend.services.business_yansi import service as business
from backend.services.business_yansi import studio

async def admission_available():
    # Existing Business can remain enabled before the additive Studio migration.
    if os.getenv('BILIGN_STUDIO_ADMISSION_ENABLED', 'false').lower() != 'true':
        raise HTTPException(503, detail={'code': 'studio_admission_disabled'})


router = APIRouter(prefix='/{business_id}/studio', tags=['Business Studio'], dependencies=[Depends(admission_available)])


@router.post('/topics', response_model=GenerationResponse, status_code=202)
async def topics(business_id: UUID, body: TopicsRequest, db=Depends(get_db), claims=Depends(get_current_user)):
    try:
        actor = await business.actor(db, claims)
        return studio.response(await studio.create_job(db, business_id, actor.id, body, 'topics'))
    except Exception:
        await db.rollback()
        raise


@router.post('/generations', response_model=GenerationResponse, status_code=202)
async def generations(business_id: UUID, body: GenerationRequest, db=Depends(get_db), claims=Depends(get_current_user)):
    try:
        actor = await business.actor(db, claims)
        return studio.response(await studio.create_job(db, business_id, actor.id, body, 'draft'))
    except Exception:
        await db.rollback()
        raise


@router.get('/generations/{generation_id}', response_model=GenerationResponse)
async def generation(business_id: UUID, generation_id: UUID, db=Depends(get_db), claims=Depends(get_current_user)):
    try:
        actor = await business.actor(db, claims)
        return studio.response(await studio.read_job(db, business_id, actor.id, generation_id))
    except Exception:
        await db.rollback()
        raise
