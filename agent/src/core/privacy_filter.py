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

    def load_blacklist(self, path: str):
        if os.path.exists(path):
            with open(path, "r") as f:
                data = json.load(f)
                self.blacklist_processes = [p.lower() for p in data.get("blacklisted_processes", [])]
                self.blacklist_titles = [t.lower() for t in data.get("blacklisted_window_titles", [])]

    def evaluate_environment(self, active_process: str, active_title: str) -> tuple[bool, str]:
        """
        Evaluates whether monitoring should be suspended.
        Returns:
            tuple: (is_sensitive: bool, status_reason: str)
        """
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
        return False, "Clean"