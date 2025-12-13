# -*- coding: utf-8 -*-
"""
EZA Proxy - Alerting Service
Slack webhook integration and alert event management
"""

import logging
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory stores (in production, use database)
alert_rules: Dict[str, List[Dict[str, Any]]] = {}  # org_id -> rules
webhook_configs: Dict[str, Dict[str, Any]] = {}  # org_id -> webhook config
alert_events: Dict[str, List[Dict[str, Any]]] = {}  # org_id -> events


async def send_slack_alert(webhook_url: str, payload: dict) -> bool:
    """
    Send alert to Slack via Incoming Webhook
    Returns True if successful, False otherwise
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
            logger.info(f"[Alerting] Slack webhook sent successfully")
            return True
    except Exception as e:
        logger.error(f"[Alerting] Slack webhook error: {e}")
        return False


def format_slack_message(alert_type: str, severity: str, message: str, details: Dict[str, Any]) -> str:
    """Format alert message for Slack"""
    org_id = details.get("org_id", "unknown")
    suggested_action = details.get("suggested_action", "Monitor")
    
    text = f"[EZA-ALERT] {message}\n"
    text += f"org_id={org_id}\n"
    text += f"type={alert_type}\n"
    text += f"severity={severity}\n"
    text += f'suggested_action="{suggested_action}"'
    
    # Add additional details
    if "latency_ms" in details:
        text += f"\nlatency_ms={details['latency_ms']}"
    if "error_rate" in details:
        text += f"\nerror_rate={details['error_rate']}%"
    if "risk_score" in details:
        text += f"\nrisk_score={details['risk_score']}"
    if "provider" in details:
        text += f"\nprovider={details['provider']}"
    
    return text


async def create_alert_event(
    org_id: str,
    alert_type: str,
    severity: str,
    message: str,
    details: Dict[str, Any],
) -> Dict[str, Any]:
    """Create and process alert event"""
    import uuid
    
    event = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "type": alert_type,
        "severity": severity,
        "message": message,
        "details": details,
        "created_at": datetime.utcnow().isoformat(),
        "webhook_sent": False,
        "webhook_response": None,
    }
    
    # Store event
    if org_id not in alert_events:
        alert_events[org_id] = []
    alert_events[org_id].append(event)
    
    # Keep only last 1000 events per org
    if len(alert_events[org_id]) > 1000:
        alert_events[org_id] = alert_events[org_id][-1000:]
    
    # Check if rule is enabled and webhook should be sent
    rules = alert_rules.get(org_id, get_default_rules())
    rule_name_map = {
        "LATENCY": "LATENCY_THRESHOLD",
        "ERROR_RATE": "ERROR_RATE_SPIKE",
        "FAIL_SAFE": "FAIL_SAFE_TRIGGERED",
    }
    rule_name = rule_name_map.get(alert_type, f"{alert_type}_THRESHOLD")
    rule = next((r for r in rules if r["name"] == rule_name), None)
    
    if rule and rule.get("enabled", True) and rule.get("send_webhook", True):
        # Get webhook config
        webhook_config = webhook_configs.get(org_id)
        if webhook_config and webhook_config.get("url"):
            # Send to Slack
            slack_payload = {
                "text": format_slack_message(alert_type, severity, message, details)
            }
            success = await send_slack_alert(webhook_config["url"], slack_payload)
            event["webhook_sent"] = success
            event["webhook_response"] = "success" if success else "failed"
    
    # Log to audit (would use proper audit system in production)
    logger.warning(
        f"[Alert] Event created: org={org_id}, type={alert_type}, severity={severity}, "
        f"webhook_sent={event['webhook_sent']}"
    )
    
    return event


def get_default_rules() -> List[Dict[str, Any]]:
    """Get default alert rules"""
    return [
        {
            "name": "LATENCY_THRESHOLD",
            "enabled": True,
            "severity": "warning",
            "send_webhook": True,
            "description": "Latency SLA sınırını aşınca alert üretir",
        },
        {
            "name": "ERROR_RATE_SPIKE",
            "enabled": True,
            "severity": "warning",
            "send_webhook": True,
            "description": "Error rate belirli eşiği aşınca alert üretir",
        },
        {
            "name": "FAIL_SAFE_TRIGGERED",
            "enabled": True,
            "severity": "critical",
            "send_webhook": True,
            "description": "Fail-safe tespit edildiğinde kritik alarm",
        },
    ]


def get_alert_rules(org_id: str) -> List[Dict[str, Any]]:
    """Get alert rules for organization"""
    if org_id not in alert_rules:
        alert_rules[org_id] = get_default_rules()
    return alert_rules[org_id]


def update_alert_rules(org_id: str, rules: List[Dict[str, Any]]):
    """Update alert rules for organization"""
    # Merge with existing rules
    existing_rules = get_alert_rules(org_id)
    rule_map = {r["name"]: r for r in existing_rules}
    
    for rule_update in rules:
        rule_name = rule_update.get("name")
        if rule_name in rule_map:
            rule_map[rule_name].update(rule_update)
    
    alert_rules[org_id] = list(rule_map.values())


def get_webhook_config(org_id: str) -> Dict[str, Any]:
    """Get webhook configuration for organization"""
    return webhook_configs.get(org_id, {
        "type": "slack",
        "url_configured": False,
    })


def set_webhook_config(org_id: str, webhook_type: str, url: str):
    """Set webhook configuration for organization"""
    webhook_configs[org_id] = {
        "type": webhook_type,
        "url": url,
        "url_configured": True,
        "updated_at": datetime.utcnow().isoformat(),
    }


async def test_webhook(org_id: str) -> Dict[str, Any]:
    """Test webhook configuration"""
    config = get_webhook_config(org_id)
    
    if not config.get("url_configured") or not config.get("url"):
        return {
            "success": False,
            "error": "Webhook URL not configured",
        }
    
    test_message = f"[EZA-ALERT-TEST] Webhook configuration test successful for org_id={org_id}"
    slack_payload = {"text": test_message}
    
    success = await send_slack_alert(config["url"], slack_payload)
    
    return {
        "success": success,
        "error": None if success else "Failed to send test message to Slack",
    }


def get_recent_alerts(org_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get recent alert events for organization"""
    events = alert_events.get(org_id, [])
    # Sort by created_at descending
    sorted_events = sorted(events, key=lambda x: x["created_at"], reverse=True)
    return sorted_events[:limit]


async def evaluate_alerts_for_org(org_id: str, sla_metrics: Dict[str, Any], plan: str = "free") -> List[Dict[str, Any]]:
    """
    Evaluate SLA metrics and create alerts if thresholds are exceeded
    Returns list of created alert events
    """
    from backend.routers.telemetry_websocket import SLA_THRESHOLDS
    
    threshold = SLA_THRESHOLDS.get(plan, SLA_THRESHOLDS["free"])
    created_alerts = []
    
    # Check latency threshold
    avg_latency = sla_metrics.get("avg_latency", 0)
    if avg_latency > threshold["latency_ms"]:
        severity = "critical" if avg_latency > threshold["latency_ms"] * 1.5 else "warning"
        message = f"Latency threshold exceeded ({avg_latency:.0f}ms > {threshold['latency_ms']}ms)"
        details = {
            "org_id": org_id,
            "latency_ms": avg_latency,
            "threshold": threshold["latency_ms"],
            "suggested_action": "Monitor",
        }
        try:
            event = await create_alert_event(org_id, "LATENCY", severity, message, details)
            created_alerts.append(event)
        except Exception as e:
            logger.error(f"[Alerting] Error creating latency alert: {e}")
    
    # Check error rate
    error_rate = sla_metrics.get("error_rate", 0)
    if error_rate > 5.0:
        severity = "critical" if error_rate > 10.0 else "warning"
        message = f"Error rate spike detected ({error_rate:.2f}% > 5%)"
        details = {
            "org_id": org_id,
            "error_rate": error_rate,
            "threshold": 5.0,
            "suggested_action": "Investigate",
        }
        try:
            event = await create_alert_event(org_id, "ERROR_RATE", severity, message, details)
            created_alerts.append(event)
        except Exception as e:
            logger.error(f"[Alerting] Error creating error rate alert: {e}")
    
    return created_alerts

