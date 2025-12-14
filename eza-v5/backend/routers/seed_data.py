# -*- coding: utf-8 -*-
"""
EZA Proxy - Seed Data
Demo organization and policies for testing
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Import stores from other modules
from backend.routers.organization import organizations, api_keys
from backend.routers.policy_management import org_policies, GLOBAL_POLICIES

def seed_demo_organization():
    """Seed demo organization: Demo Media Group"""
    demo_org_id = "demo-media-group"
    
    organizations[demo_org_id] = {
        "id": demo_org_id,
        "name": "Demo Media Group",
        "created_at": datetime.utcnow().isoformat(),
        "created_by": "system",
    }
    
    # Seed policies for demo org
    # RTÜK: Enabled
    if demo_org_id not in org_policies:
        org_policies[demo_org_id] = {}
    org_policies[demo_org_id]["TRT"] = {
        "enabled": True,
        "weight": 1.0,
    }
    
    # Health: Enabled
    org_policies[demo_org_id]["HEALTH"] = {
        "enabled": True,
        "weight": 1.0,
    }
    
    # FINTECH: Default Off
    org_policies[demo_org_id]["FINTECH"] = {
        "enabled": False,
        "weight": 1.0,
    }
    
    logger.info(f"[Seed] Created demo organization: Demo Media Group (ID: {demo_org_id})")
    logger.info(f"[Seed] Policies: RTÜK=Enabled, Health=Enabled, FINTECH=Disabled")
    
    return demo_org_id

# Auto-seed disabled - production mode
# Organizations must be created through API
# if __name__ != "__main__":
#     seed_demo_organization()

