import re
import uuid
import datetime
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from ..database import get_db_connection

logger = logging.getLogger("privacy_rules")

router = APIRouter(prefix="/api/v1/privacy", tags=["Privacy Rules Engine"])

class PrivacyRuleItem(BaseModel):
    rule_id: str
    name: str
    category: str = Field(..., description="'regex', 'domain', 'process', or 'window_title'")
    pattern: str
    replacement: str = "[REDACTED]"
    action: str = Field(default="mask_and_block", description="'mask', 'block_capture', or 'mask_and_block'")
    reason: str
    enabled: bool = True
    is_builtin: bool = False
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class PrivacyRuleCreate(BaseModel):
    name: str
    category: str
    pattern: str
    replacement: Optional[str] = "[REDACTED]"
    action: Optional[str] = "mask_and_block"
    reason: Optional[str] = None
    enabled: bool = True
    description: Optional[str] = None

class PrivacyRuleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    pattern: Optional[str] = None
    replacement: Optional[str] = None
    action: Optional[str] = None
    reason: Optional[str] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None

class PrivacyTestRequest(BaseModel):
    text: str = ""
    process: Optional[str] = None
    window_title: Optional[str] = None

# Default built-in dynamic ruleset
DEFAULT_BUILTIN_RULES: List[Dict[str, Any]] = [
    {
        "rule_id": "rule_credit_cards",
        "name": "Payment Card Numbers (PCI-DSS)",
        "category": "regex",
        "pattern": r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
        "replacement": "[REDACTED_CARD]",
        "action": "mask_and_block",
        "reason": "DLP_Credit_Card",
        "enabled": True,
        "is_builtin": True,
        "description": "Detects and redacts standard 16-digit credit and debit card numbers."
    },
    {
        "rule_id": "rule_ssn",
        "name": "Social Security Numbers (SSN)",
        "category": "regex",
        "pattern": r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b",
        "replacement": "[REDACTED_SSN]",
        "action": "mask_and_block",
        "reason": "DLP_SSN",
        "enabled": True,
        "is_builtin": True,
        "description": "Detects and masks 9-digit US Social Security Numbers."
    },
    {
        "rule_id": "rule_credentials",
        "name": "Passwords & Secret Key Assignments",
        "category": "regex",
        "pattern": r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|pin|cvv)\s*[:=]\s*(\S+)",
        "replacement": r"\1=[REDACTED_SECRET]",
        "action": "mask_and_block",
        "reason": "DLP_Credential",
        "enabled": True,
        "is_builtin": True,
        "description": "Intercepts credential assignments and masks secret values in transit."
    },
    {
        "rule_id": "rule_banking_domains",
        "name": "Financial & Banking Portals",
        "category": "domain",
        "pattern": r"(?i)\b(chase\.com|bankofamerica\.com|wellsfargo\.com|capitalone\.com|citibank\.com|paypal\.com)\b",
        "replacement": "[BLOCKED_DOMAIN]",
        "action": "mask_and_block",
        "reason": "Banking_Domain_Detected",
        "enabled": True,
        "is_builtin": True,
        "description": "Halts screen capture and masks keystrokes when banking portals are active."
    },
    {
        "rule_id": "rule_process_vaults",
        "name": "Password Vaults & Authenticators",
        "category": "process",
        "pattern": r"(?i)(1password|keepass|bitwarden|nordpass|lastpass|dashlane|authenticator)\.exe",
        "replacement": "[PROTECTED_VAULT]",
        "action": "block_capture",
        "reason": "Process_Blacklisted",
        "enabled": True,
        "is_builtin": True,
        "description": "Prevents screen and keyboard exfiltration during password vault access."
    },
    {
        "rule_id": "rule_auth_titles",
        "name": "Authentication & MFA Prompts",
        "category": "window_title",
        "pattern": r"(?i)(sign in|log in|login|password|2fa|two-factor|authentication required)",
        "replacement": "[AUTH_PROMPT]",
        "action": "block_capture",
        "reason": "Title_Blacklisted",
        "enabled": True,
        "is_builtin": True,
        "description": "Suppresses screenshots while login prompts or MFA verification are open."
    }
]

IN_MEMORY_RULES: Dict[str, Dict[str, Any]] = {
    r["rule_id"]: dict(r, created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
    for r in DEFAULT_BUILTIN_RULES
}

def seed_db_privacy_rules():
    """Initializes default built-in rules in the database if empty."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                for rule in DEFAULT_BUILTIN_RULES:
                    cur.execute("""
                        INSERT INTO privacy_rules (
                            rule_id, name, category, pattern, replacement, action,
                            reason, enabled, is_builtin, description
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (rule_id) DO NOTHING;
                    """, (
                        rule["rule_id"], rule["name"], rule["category"], rule["pattern"],
                        rule["replacement"], rule["action"], rule["reason"], rule["enabled"],
                        rule["is_builtin"], rule["description"]
                    ))
                conn.commit()
    except Exception as e:
        logger.debug(f"Database rule seeding notice: {e}")

@router.get("/rules", response_model=List[PrivacyRuleItem])
def list_privacy_rules(category: Optional[str] = None, enabled_only: bool = False):
    """Retrieves all dynamic privacy rules from database or memory cache."""
    seed_db_privacy_rules()
    db_rules = []
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT rule_id, name, category, pattern, replacement, action,
                           reason, enabled, is_builtin, description, created_at, updated_at
                    FROM privacy_rules
                    WHERE 1=1
                """
                params = []
                if category:
                    query += " AND category = %s"
                    params.append(category)
                if enabled_only:
                    query += " AND enabled = TRUE"
                query += " ORDER BY is_builtin DESC, created_at ASC;"

                cur.execute(query, tuple(params))
                for r in cur.fetchall():
                    db_rules.append({
                        "rule_id": r[0],
                        "name": r[1],
                        "category": r[2],
                        "pattern": r[3],
                        "replacement": r[4] or "[REDACTED]",
                        "action": r[5] or "mask_and_block",
                        "reason": r[6],
                        "enabled": bool(r[7]),
                        "is_builtin": bool(r[8]),
                        "description": r[9] or "",
                        "created_at": r[10].isoformat() if r[10] else None,
                        "updated_at": r[11].isoformat() if r[11] else None
                    })
                if db_rules:
                    return db_rules
    except Exception as e:
        logger.debug(f"Database list_privacy_rules query deferred: {e}")

    # Fallback to in-memory rules
    results = list(IN_MEMORY_RULES.values())
    if category:
        results = [r for r in results if r.get("category") == category]
    if enabled_only:
        results = [r for r in results if r.get("enabled") is True]
    return sorted(results, key=lambda x: (not x.get("is_builtin", False), x.get("name", "")))

@router.post("/rules", response_model=PrivacyRuleItem)
def create_privacy_rule(payload: PrivacyRuleCreate):
    """Creates a new dynamic privacy rule."""
    rule_id = f"custom_rule_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    reason_code = payload.reason or f"DLP_{re.sub(r'[^a-zA-Z0-9_]', '_', payload.name)}"

    # Validate regex compile
    try:
        re.compile(payload.pattern)
    except re.error as e:
        raise HTTPException(status_code=400, detail=f"Invalid regular expression syntax: {e}")

    rule_dict = {
        "rule_id": rule_id,
        "name": payload.name,
        "category": payload.category,
        "pattern": payload.pattern,
        "replacement": payload.replacement or "[REDACTED]",
        "action": payload.action or "mask_and_block",
        "reason": reason_code,
        "enabled": payload.enabled,
        "is_builtin": False,
        "description": payload.description or "",
        "created_at": now_iso,
        "updated_at": now_iso
    }

    # Store in memory
    IN_MEMORY_RULES[rule_id] = rule_dict

    # Store in database
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO privacy_rules (
                        rule_id, name, category, pattern, replacement, action,
                        reason, enabled, is_builtin, description
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, FALSE, %s);
                """, (
                    rule_id, payload.name, payload.category, payload.pattern,
                    rule_dict["replacement"], rule_dict["action"], reason_code,
                    payload.enabled, rule_dict["description"]
                ))
                conn.commit()
    except Exception as e:
        logger.debug(f"Database insert rule deferred: {e}")

    return rule_dict

@router.put("/rules/{rule_id}", response_model=PrivacyRuleItem)
def update_privacy_rule(rule_id: str, payload: PrivacyRuleUpdate):
    """Updates an existing dynamic privacy rule."""
    if payload.pattern:
        try:
            re.compile(payload.pattern)
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regular expression syntax: {e}")

    existing = IN_MEMORY_RULES.get(rule_id, {})
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    updated = dict(existing)
    if payload.name is not None:
        updated["name"] = payload.name
    if payload.category is not None:
        updated["category"] = payload.category
    if payload.pattern is not None:
        updated["pattern"] = payload.pattern
    if payload.replacement is not None:
        updated["replacement"] = payload.replacement
    if payload.action is not None:
        updated["action"] = payload.action
    if payload.reason is not None:
        updated["reason"] = payload.reason
    if payload.enabled is not None:
        updated["enabled"] = payload.enabled
    if payload.description is not None:
        updated["description"] = payload.description
    updated["updated_at"] = now_iso
    updated["rule_id"] = rule_id

    IN_MEMORY_RULES[rule_id] = updated

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE privacy_rules
                    SET name = COALESCE(%s, name),
                        category = COALESCE(%s, category),
                        pattern = COALESCE(%s, pattern),
                        replacement = COALESCE(%s, replacement),
                        action = COALESCE(%s, action),
                        reason = COALESCE(%s, reason),
                        enabled = COALESCE(%s, enabled),
                        description = COALESCE(%s, description),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE rule_id = %s;
                """, (
                    payload.name, payload.category, payload.pattern, payload.replacement,
                    payload.action, payload.reason, payload.enabled, payload.description,
                    rule_id
                ))
                conn.commit()
    except Exception as e:
        logger.debug(f"Database update rule deferred: {e}")

    return updated

@router.delete("/rules/{rule_id}")
def delete_privacy_rule(rule_id: str):
    """Deletes a custom privacy rule. Built-in rules cannot be permanently deleted."""
    if rule_id in IN_MEMORY_RULES and IN_MEMORY_RULES[rule_id].get("is_builtin"):
        raise HTTPException(status_code=400, detail="Built-in core privacy rules cannot be deleted. You can disable them instead.")

    IN_MEMORY_RULES.pop(rule_id, None)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM privacy_rules WHERE rule_id = %s AND is_builtin = FALSE;", (rule_id,))
                conn.commit()
    except Exception as e:
        logger.debug(f"Database delete rule deferred: {e}")

    return {"status": "deleted", "rule_id": rule_id}

@router.post("/test")
def test_privacy_rules(payload: PrivacyTestRequest):
    """
    Simulates real-time dynamic privacy evaluation on input text, process, or window title.
    Returns matched rules, detection reasons, and redacted result text.
    """
    matched_rules = []
    matched_reasons = []
    redacted_text = payload.text or ""
    block_capture = False

    raw_rules = list_privacy_rules(enabled_only=True)
    rules: List[PrivacyRuleItem] = [
        PrivacyRuleItem(**r) if isinstance(r, dict) else r
        for r in raw_rules
    ]

    # Process rules
    if payload.process:
        proc_clean = payload.process.lower()
        for r in [x for x in rules if x.category == "process"]:
            try:
                if re.search(r.pattern, proc_clean, re.IGNORECASE) or r.pattern.lower() in proc_clean:
                    matched_rules.append(r.dict() if hasattr(r, "dict") else dict(r))
                    matched_reasons.append(r.reason)
                    if "block" in (r.action or ""):
                        block_capture = True
            except Exception:
                pass

    # Window title rules
    if payload.window_title:
        title_clean = payload.window_title.lower()
        for r in [x for x in rules if x.category == "window_title"]:
            try:
                if re.search(r.pattern, title_clean, re.IGNORECASE) or r.pattern.lower() in title_clean:
                    matched_rules.append(r.dict() if hasattr(r, "dict") else dict(r))
                    matched_reasons.append(r.reason)
                    if "block" in (r.action or ""):
                        block_capture = True
            except Exception:
                pass

    # Regex and domain rules applied to text
    for r in [x for x in rules if x.category in ("regex", "domain")]:
        try:
            compiled = re.compile(r.pattern, re.IGNORECASE)
            if compiled.search(redacted_text):
                matched_rules.append(r.dict() if hasattr(r, "dict") else dict(r))
                matched_reasons.append(r.reason)
                if "block" in (r.action or ""):
                    block_capture = True
                if "mask" in (r.action or ""):
                    redacted_text = compiled.sub(r.replacement or "[REDACTED]", redacted_text)
        except Exception as e:
            logger.warning(f"Rule regex execution error on {r.rule_id}: {e}")

    return {
        "is_sensitive": len(matched_reasons) > 0,
        "matched_reasons": list(set(matched_reasons)),
        "matched_rules": matched_rules,
        "sanitized_text": redacted_text,
        "blocked_capture": block_capture
    }

