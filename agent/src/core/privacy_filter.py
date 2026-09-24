import re
import json
import os

class PrivacyFilter:
    def __init__(self, config_path: str = "config/blacklist.json"):
        self.blacklist_processes = []
        self.blacklist_titles = []
        self.load_blacklist(config_path)

        # Precompiled RegEx patterns for DLP detection
        self.cc_pattern = re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b')
        self.ssn_pattern = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
        # Captures variations like password=..., pwd: ..., secret=..., token=...
        self.password_pattern = re.compile(
            r'(?i)\b(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*(\S+)'
        )

    def load_blacklist(self, path: str):
        if os.path.exists(path):
            with open(path, "r") as f:
                data = json.load(f)
                self.blacklist_processes = [p.lower() for p in data.get("blacklisted_processes", [])]
                self.blacklist_titles = [t.lower() for t in data.get("blacklisted_window_titles", [])]

    def evaluate_environment(self, active_process: str, active_title: str) -> tuple[bool, str]:
        p_name = active_process.lower()
        if any(b in p_name for b in self.blacklist_processes):
            return True, "Process_Blacklisted"

        t_name = active_title.lower()
        if any(b in t_name for b in self.blacklist_titles):
            return True, "Title_Blacklisted"

        return False, "Clean"

    def scan_clipboard_for_dlp(self, text: str) -> tuple[bool, str]:
        if not text:
            return False, "No_Data"
        if self.cc_pattern.search(text):
            return True, "DLP_Credit_Card_Pattern"
        if self.ssn_pattern.search(text):
            return True, "DLP_SSN_Pattern"
        if self.password_pattern.search(text):
            return True, "DLP_Credential_Pattern"
        return False, "Clean"

    def sanitize(self, text: str) -> str:
        """Redacts DLP patterns (SSN, Credit Cards, Secrets) from text/titles."""
        if not text:
            return ""
        redacted = self.cc_pattern.sub("[REDACTED_CARD]", text)
        redacted = self.ssn_pattern.sub("[REDACTED_SSN]", redacted)
        
        # Keeps the key name (e.g. password=) but redacts the secret value
        redacted = self.password_pattern.sub(r"\1=[REDACTED_SECRET]", redacted)
        return redacted