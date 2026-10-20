import re
import json
import os
from typing import List, Dict, Any, Optional, Tuple

DEFAULT_BUILTIN_RULES = [
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
        "pattern": r"(?i)(1password|keepass|bitwarden|nordpass|lastpass|dashlane|authenticator|signal|tor)",
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
        "pattern": r"(?i)(sign in|log in|login|password|bank of america|chase online|wells fargo|capital one|citibank|paypal|2fa|two-factor|authentication required)",
        "replacement": "[AUTH_PROMPT]",
        "action": "block_capture",
        "reason": "Title_Blacklisted",
        "enabled": True,
        "is_builtin": True,
        "description": "Suppresses screenshots while login prompts or MFA verification are open."
    }
]

class PrivacyFilter:
    """
    Dynamic Privacy Filter & Rules Engine.
    Evaluates processes, window titles, keystroke streams, and text against dynamic rules
    loaded from JSON configuration or synchronized via the backend rules engine API.
    """
    def __init__(self, config_path: str = "config/privacy_rules.json"):
        self.rules: List[Dict[str, Any]] = [dict(r) for r in DEFAULT_BUILTIN_RULES]
        self._compiled_patterns: Dict[str, re.Pattern] = {}
        self.config_path = config_path

        # Resolve path relative to agent directory if not in current working directory
        if not os.path.exists(config_path):
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            candidate = os.path.join(base_dir, config_path)
            if os.path.exists(candidate):
                self.config_path = candidate
            else:
                # Check for legacy blacklist.json fallback
                legacy_candidate = os.path.join(base_dir, "config", "blacklist.json")
                if os.path.exists(legacy_candidate):
                    self.load_blacklist(legacy_candidate)

        if os.path.exists(self.config_path):
            self.load_rules_from_file(self.config_path)

        self.compile_rules()

    def compile_rules(self):
        """Compiles regex patterns for all active rules and updates legacy compatibility caches."""
        self._compiled_patterns.clear()
        legacy_procs = []
        legacy_titles = []

        for rule in self.rules:
            if not rule.get("enabled", True):
                continue
            cat = rule.get("category")
            pat = rule.get("pattern", "")
            try:
                self._compiled_patterns[rule["rule_id"]] = re.compile(pat, re.IGNORECASE)
            except re.error as e:
                print(f"[PRIVACY FILTER WARNING] Rule {rule.get('rule_id')} pattern compile error: {e}")

            if cat == "process":
                # Extract clean process keywords for legacy access
                clean_pat = re.sub(r'[\(\)\?\:i\\|]', ' ', pat).lower()
                legacy_procs.extend([p.strip() for p in clean_pat.split() if len(p.strip()) > 2])
            elif cat == "window_title":
                clean_pat = re.sub(r'[\(\)\?\:i\\|]', ' ', pat).lower()
                legacy_titles.extend([t.strip() for t in clean_pat.split() if len(t.strip()) > 2])

        self.blacklist_processes = legacy_procs
        self.blacklist_titles = legacy_titles

        # Expose legacy pattern references for backward compatibility with existing tests
        self.cc_pattern = self._compiled_patterns.get("rule_credit_cards", re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'))
        self.ssn_pattern = self._compiled_patterns.get("rule_ssn", re.compile(r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b'))
        self.password_pattern = self._compiled_patterns.get("rule_credentials", re.compile(r'(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|pin|cvv)\s*[:=]\s*(\S+)'))
        self.banking_domains = self._compiled_patterns.get("rule_banking_domains", re.compile(r'(?i)\b(chase\.com|bankofamerica\.com|wellsfargo\.com|capitalone\.com|citibank\.com|paypal\.com)\b'))

    def load_rules_from_file(self, path: str):
        """Loads rules dynamically from a privacy_rules.json file."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "rules" in data:
                    self.rules = data["rules"]
                elif isinstance(data, list):
                    self.rules = data
                elif "blacklisted_processes" in data or "blacklisted_window_titles" in data:
                    self.load_blacklist(path)
            self.compile_rules()
        except Exception as e:
            print(f"[PRIVACY FILTER] Notice loading rules from {path}: {e}")

    def save_rules_to_file(self, path: Optional[str] = None):
        """Persists current dynamic rules to disk."""
        target_path = path or self.config_path
        try:
            os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
            with open(target_path, "w", encoding="utf-8") as f:
                json.dump({"rules": self.rules}, f, indent=2)
        except Exception as e:
            print(f"[PRIVACY FILTER ERROR] Could not save rules to {target_path}: {e}")

    def load_blacklist(self, path: str):
        """Backward compatibility loader for legacy blacklist.json files."""
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    procs = data.get("blacklisted_processes", [])
                    titles = data.get("blacklisted_window_titles", [])
                    if procs:
                        proc_pat = "(?i)(" + "|".join(re.escape(p.replace('.exe', '')) for p in procs) + ")"
                        self.add_rule({
                            "rule_id": "rule_legacy_processes",
                            "name": "Blacklisted Processes",
                            "category": "process",
                            "pattern": proc_pat,
                            "replacement": "[PROTECTED_PROCESS]",
                            "action": "block_capture",
                            "reason": "Process_Blacklisted",
                            "enabled": True,
                            "is_builtin": True
                        })
                    if titles:
                        title_pat = "(?i)(" + "|".join(re.escape(t) for t in titles) + ")"
                        self.add_rule({
                            "rule_id": "rule_legacy_titles",
                            "name": "Blacklisted Window Titles",
                            "category": "window_title",
                            "pattern": title_pat,
                            "replacement": "[PROTECTED_TITLE]",
                            "action": "block_capture",
                            "reason": "Title_Blacklisted",
                            "enabled": True,
                            "is_builtin": True
                        })
                self.compile_rules()
            except Exception as e:
                print(f"[PRIVACY FILTER] Legacy blacklist notice: {e}")

    def add_rule(self, rule_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Dynamically adds or replaces a privacy rule."""
        rule_id = rule_dict.get("rule_id") or f"custom_rule_{len(self.rules)+1}"
        rule_dict["rule_id"] = rule_id
        # Remove existing if same ID
        self.rules = [r for r in self.rules if r.get("rule_id") != rule_id]
        self.rules.append(rule_dict)
        self.compile_rules()
        return rule_dict

    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Dynamically updates an existing rule in place."""
        for rule in self.rules:
            if rule.get("rule_id") == rule_id:
                rule.update(updates)
                self.compile_rules()
                return rule
        return None

    def delete_rule(self, rule_id: str) -> bool:
        """Removes a dynamic rule."""
        before = len(self.rules)
        self.rules = [r for r in self.rules if r.get("rule_id") != rule_id]
        if len(self.rules) < before:
            self.compile_rules()
            return True
        return False

    def get_rules(self, category: Optional[str] = None, enabled_only: bool = False) -> List[Dict[str, Any]]:
        """Returns the current list of dynamic privacy rules."""
        res = self.rules
        if category:
            res = [r for r in res if r.get("category") == category]
        if enabled_only:
            res = [r for r in res if r.get("enabled", True)]
        return res

    def evaluate_environment(self, active_process: str, active_title: str) -> Tuple[bool, str]:
        """
        Dynamically evaluates active application process and foreground window title.
        Returns (is_sensitive, reason_string).
        """
        p_name = (active_process or "").lower()
        t_name = (active_title or "").lower()

        # 1. Process rules
        for rule in [r for r in self.rules if r.get("enabled", True) and r.get("category") == "process"]:
            compiled = self._compiled_patterns.get(rule["rule_id"])
            if compiled and compiled.search(p_name):
                return True, rule.get("reason", "Process_Blacklisted")

        # 2. Window Title rules
        for rule in [r for r in self.rules if r.get("enabled", True) and r.get("category") == "window_title"]:
            compiled = self._compiled_patterns.get(rule["rule_id"])
            if compiled and compiled.search(t_name):
                return True, rule.get("reason", "Title_Blacklisted")

        # 3. Domain rules evaluated against title (e.g. browser URLs in title)
        for rule in [r for r in self.rules if r.get("enabled", True) and r.get("category") == "domain"]:
            compiled = self._compiled_patterns.get(rule["rule_id"])
            if compiled and compiled.search(t_name):
                return True, rule.get("reason", "Banking_Domain_Detected")

        return False, "Clean"

    def scan_clipboard_for_dlp(self, text: str) -> Tuple[bool, str]:
        """
        Dynamically checks text against all active regex and domain rules.
        """
        if not text:
            return False, "No_Data"

        for rule in [r for r in self.rules if r.get("enabled", True) and r.get("category") in ("regex", "domain")]:
            compiled = self._compiled_patterns.get(rule["rule_id"])
            if compiled and compiled.search(text):
                base_reason = rule.get("reason", "DLP_Pattern")
                reason_str = base_reason if base_reason.endswith("_Pattern") else f"{base_reason}_Pattern"
                return True, reason_str

        return False, "Clean"

    def scan_stream(self, text: str) -> Tuple[bool, str, str]:
        """
        Dynamically scans a live keystroke stream or buffer for all active DLP rules.
        Returns (is_sensitive, detection_reason, sanitized_text).
        """
        if not text:
            return False, "Clean", text

        reasons = []
        for rule in [r for r in self.rules if r.get("enabled", True) and r.get("category") in ("regex", "domain")]:
            compiled = self._compiled_patterns.get(rule["rule_id"])
            if compiled and compiled.search(text):
                # Format friendly reason tag (e.g. Credit_Card, SSN, Credential)
                r_code = rule.get("reason", "Sensitive")
                clean_code = re.sub(r'^DLP_', '', r_code).replace('_Detected', '')
                if clean_code not in reasons:
                    reasons.append(clean_code)

        is_sensitive = len(reasons) > 0
        reason_str = f"DLP_{'_'.join(reasons)}" if is_sensitive else "Clean"
        sanitized = self.sanitize(text) if is_sensitive else text
        return is_sensitive, reason_str, sanitized

    def sanitize(self, text: str) -> str:
        """
        Redacts all sensitive patterns using dynamic rules and their configured replacement masks.
        """
        if not text:
            return ""

        redacted = text
        for rule in [r for r in self.rules if r.get("enabled", True) and r.get("category") in ("regex", "domain")]:
            compiled = self._compiled_patterns.get(rule["rule_id"])
            if compiled:
                replacement = rule.get("replacement", "[REDACTED]")
                try:
                    redacted = compiled.sub(replacement, redacted)
                except Exception as e:
                    print(f"[PRIVACY FILTER] Sanitization error on rule {rule.get('rule_id')}: {e}")

        return redacted

    def sync_from_backend(self, server_url: str):
        """Synchronizes dynamic rules from the central backend API."""
        try:
            import requests
            url = f"{server_url.rstrip('/')}/privacy/rules"
            resp = requests.get(url, timeout=3)
            if resp.status_code == 200:
                backend_rules = resp.json()
                if isinstance(backend_rules, list) and len(backend_rules) > 0:
                    self.rules = backend_rules
                    self.compile_rules()
                    self.save_rules_to_file()
                    print(f"[PRIVACY FILTER] Synchronized {len(self.rules)} rules from backend.")
        except Exception as e:
            print(f"[PRIVACY FILTER] Backend rule sync notice: {e}")