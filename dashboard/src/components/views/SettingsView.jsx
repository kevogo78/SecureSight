import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, Key, Shield, Sliders, RefreshCw, Copy, Check, 
  Plus, Trash2, Globe, Wifi, CheckCircle2, AlertCircle, Save,
  FileText, Video, Lock, AlertTriangle, Edit3, X, Play, Filter,
  Search, Tag, ShieldAlert, ShieldCheck, Terminal, Cpu
} from 'lucide-react';
import { 
  checkBackendHealth, 
  fetchPrivacyRulesApi, 
  createPrivacyRuleApi, 
  updatePrivacyRuleApi, 
  deletePrivacyRuleApi, 
  testPrivacyRuleApi 
} from '../../services/api';

const DEFAULT_FALLBACK_RULES = [
  {
    rule_id: 'rule_credit_cards',
    name: 'Payment Card Numbers (PCI-DSS)',
    category: 'regex',
    pattern: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
    replacement: '[REDACTED_CARD]',
    action: 'mask_and_block',
    reason: 'DLP_Credit_Card',
    enabled: true,
    is_builtin: true,
    description: 'Detects and redacts standard 16-digit credit and debit card numbers.'
  },
  {
    rule_id: 'rule_ssn',
    name: 'Social Security Numbers (SSN)',
    category: 'regex',
    pattern: '\\b\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4}\\b',
    replacement: '[REDACTED_SSN]',
    action: 'mask_and_block',
    reason: 'DLP_SSN',
    enabled: true,
    is_builtin: true,
    description: 'Detects and masks 9-digit US Social Security Numbers.'
  },
  {
    rule_id: 'rule_credentials',
    name: 'Passwords & Secret Key Assignments',
    category: 'regex',
    pattern: '(?i)\\b(password|passwd|pwd|secret|token|api[_-]?key|pin|cvv)\\s*[:=]\\s*(\\S+)',
    replacement: '$1=[REDACTED_SECRET]',
    action: 'mask_and_block',
    reason: 'DLP_Credential',
    enabled: true,
    is_builtin: true,
    description: 'Intercepts credential assignments and masks secret values in transit.'
  },
  {
    rule_id: 'rule_banking_domains',
    name: 'Financial & Banking Portals',
    category: 'domain',
    pattern: '(?i)\\b(chase\\.com|bankofamerica\\.com|wellsfargo\\.com|capitalone\\.com|citibank\\.com|paypal\\.com)\\b',
    replacement: '[BLOCKED_DOMAIN]',
    action: 'mask_and_block',
    reason: 'Banking_Domain_Detected',
    enabled: true,
    is_builtin: true,
    description: 'Halts screen capture and masks keystrokes when banking portals are active.'
  },
  {
    rule_id: 'rule_process_vaults',
    name: 'Password Vaults & Authenticators',
    category: 'process',
    pattern: '(?i)(1password|keepass|bitwarden|nordpass|lastpass|dashlane|authenticator)\\.exe',
    replacement: '[PROTECTED_VAULT]',
    action: 'block_capture',
    reason: 'Process_Blacklisted',
    enabled: true,
    is_builtin: true,
    description: 'Prevents screen and keyboard exfiltration during password vault access.'
  },
  {
    rule_id: 'rule_auth_titles',
    name: 'Authentication & MFA Prompts',
    category: 'window_title',
    pattern: '(?i)(sign in|log in|login|password|2fa|two-factor|authentication required)',
    replacement: '[AUTH_PROMPT]',
    action: 'block_capture',
    reason: 'Title_Blacklisted',
    enabled: true,
    is_builtin: true,
    description: 'Suppresses screenshots while login prompts or MFA verification are open.'
  }
];

export default function SettingsView() {
  const [pollingInterval, setPollingInterval] = useState(10);
  const [screenshotTicks, setScreenshotTicks] = useState(6);
  const [cryptoKey, setCryptoKey] = useState('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Dynamic Privacy Rules State
  const [rules, setRules] = useState(DEFAULT_FALLBACK_RULES);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ruleFeedback, setRuleFeedback] = useState(null);

  // Modal State for Add / Edit Rule
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    category: 'regex',
    pattern: '',
    replacement: '[REDACTED]',
    action: 'mask_and_block',
    reason: '',
    description: '',
    enabled: true
  });
  const [regexError, setRegexError] = useState('');

  // Privacy Sandbox Simulator State
  const [sandboxText, setSandboxText] = useState('Employee card 4111-2222-3333-4444 entered password: SuperSecret99! on chase.com');
  const [sandboxProcess, setSandboxProcess] = useState('chrome.exe');
  const [sandboxTitle, setSandboxTitle] = useState('Chase Online Banking - Account Overview');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [isTestingSandbox, setIsTestingSandbox] = useState(false);

  // Diagnostics state
  const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:8000');
  const [pingStatus, setPingStatus] = useState(null);
  const [isPinging, setIsPinging] = useState(false);

  // Load Rules from Backend
  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const data = await fetchPrivacyRulesApi();
      if (Array.isArray(data) && data.length > 0) {
        setRules(data);
      }
    } catch (err) {
      console.warn('Using cached privacy rules:', err);
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(cryptoKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateNewKey = () => {
    const chars = '0123456789abcdef';
    let key = '';
    for (let i = 0; i < 64; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    setCryptoKey(key);
  };

  const handlePing = async () => {
    setIsPinging(true);
    setPingStatus(null);
    const result = await checkBackendHealth();
    setIsPinging(false);
    setPingStatus(result);
  };

  const handleSaveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Rule Management Handlers
  const handleToggleRule = async (rule) => {
    const newEnabled = !rule.enabled;
    // Optimistic UI update
    setRules(prev => prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled: newEnabled } : r));
    try {
      await updatePrivacyRuleApi(rule.rule_id, { enabled: newEnabled });
      showFeedback(`Rule "${rule.name}" is now ${newEnabled ? 'Enabled' : 'Disabled'}.`);
    } catch (err) {
      console.warn('Failed to update rule on backend:', err);
      showFeedback('Rule state updated locally (backend sync deferred).');
    }
  };

  const showFeedback = (msg, isError = false) => {
    setRuleFeedback({ message: msg, isError });
    setTimeout(() => setRuleFeedback(null), 3500);
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      category: 'regex',
      pattern: '',
      replacement: '[REDACTED]',
      action: 'mask_and_block',
      reason: '',
      description: '',
      enabled: true
    });
    setRegexError('');
    setIsModalOpen(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name || '',
      category: rule.category || 'regex',
      pattern: rule.pattern || '',
      replacement: rule.replacement || '[REDACTED]',
      action: rule.action || 'mask_and_block',
      reason: rule.reason || '',
      description: rule.description || '',
      enabled: rule.enabled !== false
    });
    setRegexError('');
    setIsModalOpen(true);
  };

  const validatePattern = (pattern) => {
    try {
      new RegExp(pattern);
      setRegexError('');
      return true;
    } catch (e) {
      setRegexError(e.message);
      return false;
    }
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.name.trim() || !ruleForm.pattern.trim()) {
      showFeedback('Name and pattern are required.', true);
      return;
    }

    if (!validatePattern(ruleForm.pattern)) {
      showFeedback('Invalid regular expression pattern.', true);
      return;
    }

    const payload = {
      ...ruleForm,
      reason: ruleForm.reason.trim() || `DLP_${ruleForm.name.trim().replace(/[^a-zA-Z0-9_]/g, '_')}`
    };

    try {
      if (editingRule) {
        // Update existing rule
        const updated = await updatePrivacyRuleApi(editingRule.rule_id, payload);
        setRules(prev => prev.map(r => r.rule_id === editingRule.rule_id ? { ...r, ...updated } : r));
        showFeedback(`Successfully updated rule "${ruleForm.name}".`);
      } else {
        // Create new rule
        const created = await createPrivacyRuleApi(payload);
        setRules(prev => [created, ...prev]);
        showFeedback(`Successfully created dynamic rule "${ruleForm.name}".`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.warn('API error saving rule, applying locally:', err);
      if (editingRule) {
        setRules(prev => prev.map(r => r.rule_id === editingRule.rule_id ? { ...r, ...payload } : r));
        showFeedback(`Updated rule "${ruleForm.name}" locally.`);
      } else {
        const localRule = {
          ...payload,
          rule_id: `custom_${Date.now()}`,
          is_builtin: false
        };
        setRules(prev => [localRule, ...prev]);
        showFeedback(`Added dynamic rule "${ruleForm.name}" locally.`);
      }
      setIsModalOpen(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (rule.is_builtin) {
      showFeedback('Built-in system rules cannot be deleted. You can disable them instead.', true);
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete rule "${rule.name}"?`)) {
      return;
    }

    try {
      await deletePrivacyRuleApi(rule.rule_id);
      setRules(prev => prev.filter(r => r.rule_id !== rule.rule_id));
      showFeedback(`Rule "${rule.name}" removed successfully.`);
    } catch (err) {
      console.warn('Delete API warning, removing locally:', err);
      setRules(prev => prev.filter(r => r.rule_id !== rule.rule_id));
      showFeedback(`Rule "${rule.name}" removed.`);
    }
  };

  // Run Sandbox Simulation
  const handleRunSandbox = async () => {
    setIsTestingSandbox(true);
    try {
      const res = await testPrivacyRuleApi({
        text: sandboxText,
        process: sandboxProcess,
        window_title: sandboxTitle
      });
      setSandboxResult(res);
    } catch (err) {
      console.warn('Sandbox backend offline, executing client-side simulation:', err);
      // Client-side fallback simulation
      let sanitized = sandboxText;
      const matched = [];
      let blocked = false;

      rules.filter(r => r.enabled).forEach(r => {
        try {
          if (r.category === 'process' && sandboxProcess) {
            const re = new RegExp(r.pattern, 'i');
            if (re.test(sandboxProcess)) {
              matched.push(r.reason);
              if (r.action.includes('block')) blocked = true;
            }
          }
          if (r.category === 'window_title' && sandboxTitle) {
            const re = new RegExp(r.pattern, 'i');
            if (re.test(sandboxTitle)) {
              matched.push(r.reason);
              if (r.action.includes('block')) blocked = true;
            }
          }
          if (['regex', 'domain'].includes(r.category) && sanitized) {
            const re = new RegExp(r.pattern, 'gi');
            if (re.test(sanitized)) {
              matched.push(r.reason);
              if (r.action.includes('block')) blocked = true;
              if (r.action.includes('mask')) {
                sanitized = sanitized.replace(re, r.replacement || '[REDACTED]');
              }
            }
          }
        } catch (e) {
          // ignore invalid client-side regex
        }
      });

      setSandboxResult({
        is_sensitive: matched.length > 0,
        matched_reasons: Array.from(new Set(matched)),
        sanitized_text: sanitized,
        blocked_capture: blocked
      });
    } finally {
      setIsTestingSandbox(false);
    }
  };

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.pattern && r.pattern.toLowerCase().includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [rules, selectedCategory, searchQuery]);

  // Preset Sandbox Scenarios
  const loadPreset = (preset) => {
    if (preset === 'card_password') {
      setSandboxText('Cardholder 4111-2222-3333-4444 authorized payment with password=SuperPass123!');
      setSandboxProcess('chrome.exe');
      setSandboxTitle('Checkout Gateway - Authorize Transaction');
    } else if (preset === 'banking_portal') {
      setSandboxText('Transferring $500 balance to savings account at chase.com');
      setSandboxProcess('msedge.exe');
      setSandboxTitle('Chase Online Banking - Account Overview');
    } else if (preset === 'password_vault') {
      setSandboxText('Copying database root password to clipboard');
      setSandboxProcess('1password.exe');
      setSandboxTitle('1Password - Master Key Access');
    } else if (preset === 'ssn_hr') {
      setSandboxText('New employee onboarding record: SSN 123-45-6789 verified.');
      setSandboxProcess('excel.exe');
      setSandboxTitle('HR_Payroll_Quarterly.xlsx - Excel');
    }
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'regex':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">REGEX DLP</span>;
      case 'domain':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">DOMAIN FILTER</span>;
      case 'process':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">PROCESS</span>;
      case 'window_title':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">WINDOW TITLE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{cat}</span>;
    }
  };

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">System &amp; Privacy Configuration</h3>
          <p className="text-xs text-slate-500">
            Configure endpoint telemetry intervals, keystroke capture options, session video recordings, and dynamic DLP privacy rules.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Changes Saved' : 'Save Fleet Configuration'}</span>
        </button>
      </div>

      {/* Telemetry Timers & Master Encryption Key */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Agent Polling & Timers */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">Agent Telemetry Timing</h4>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Telemetry Reporting Frequency</span>
              <span className="text-emerald-600 font-bold">{pollingInterval} seconds</span>
            </div>
            <input
              type="range"
              min="2"
              max="60"
              step="2"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">Interval between endpoint HTTP POST payloads to FastAPI.</p>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Encrypted Screenshot Trigger</span>
              <span className="text-emerald-600 font-bold">Every {screenshotTicks} ticks ({screenshotTicks * pollingInterval}s)</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={screenshotTicks}
              onChange={(e) => setScreenshotTicks(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">Screen buffers are redacted in memory before S3 upload.</p>
          </div>
        </div>

        {/* Section 2: Cryptographic Engine Settings */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <Key className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">AES-256-GCM Master Encryption Key</h4>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Active Key Hex (256-bit)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={cryptoKey}
                className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={handleCopyKey}
                title="Copy Key"
                className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Shared between client agent and dashboard for verifiable decrypting.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={generateNewKey}
              className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate Random 256-bit Key</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: REFACTORED DYNAMIC PRIVACY RULES ENGINE MANAGER */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        {/* Rules Header & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-900">Dynamic Privacy Filter &amp; Rules Engine</h4>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                  {rules.filter(r => r.enabled).length} Active of {rules.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dynamic DLP inspection rules applied to keypress streams, window titles, URLs, and active process executables without code modification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={loadRules}
              disabled={loadingRules}
              title="Synchronize with Backend Rules Engine"
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRules ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Privacy Rule</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {ruleFeedback && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border transition ${
            ruleFeedback.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {ruleFeedback.isError ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <span className="font-semibold">{ruleFeedback.message}</span>
          </div>
        )}

        {/* Search & Category Filter Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'regex', label: 'Regex Patterns' },
              { id: 'domain', label: 'Blocked Domains' },
              { id: 'process', label: 'Protected Processes' },
              { id: 'window_title', label: 'Window Titles' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search rules, patterns, reasons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Dynamic Rules Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Rule Name &amp; Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Pattern / Expression</th>
                  <th className="py-3 px-4">Replacement / Action</th>
                  <th className="py-3 px-4">Reason Code</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No privacy rules matched your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr 
                      key={rule.rule_id} 
                      className={`hover:bg-slate-50/80 transition ${
                        !rule.enabled ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Status Toggle */}
                      <td className="py-3 px-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => handleToggleRule(rule)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </td>

                      {/* Rule Name & Built-in Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{rule.name}</span>
                          {rule.is_builtin ? (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-bold">
                              CORE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                              CUSTOM
                            </span>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {rule.description}
                          </p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getCategoryBadge(rule.category)}
                      </td>

                      {/* Pattern */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 max-w-[200px] truncate" title={rule.pattern}>
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {rule.pattern}
                        </code>
                      </td>

                      {/* Replacement / Action */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[11px] text-slate-800 font-semibold">
                            {rule.replacement || '[REDACTED]'}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">
                            {rule.action === 'mask_and_block' ? 'Redact & Suppress' : 
                             rule.action === 'mask' ? 'Redact Only' : 'Suppress Screen'}
                          </span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded border border-slate-200">
                          {rule.reason || 'DLP_Rule'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(rule)}
                            title="Edit Rule"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {rule.is_builtin ? (
                            <span 
                              title="Built-in core rules cannot be deleted. You may disable them." 
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDeleteRule(rule)}
                              title="Delete Custom Rule"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION: LIVE PRIVACY SANDBOX & REDACTION SIMULATOR */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Live Privacy Sandbox &amp; Redaction Simulator</h4>
              <p className="text-xs text-slate-500">
                Simulate keystroke streams and active foreground application context to verify dynamic rule enforcement in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunSandbox}
              disabled={isTestingSandbox}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isTestingSandbox ? 'Evaluating...' : 'Simulate Inspection'}</span>
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Quick Presets:
          </span>
          <button
            type="button"
            onClick={() => loadPreset('card_password')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer border border-slate-200"
          >
            Credit Card + Password
          </button>
          <button
            type="button"
            onClick={() => loadPreset('banking_portal')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer border border-slate-200"
          >
            Banking Domain (chase.com)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('password_vault')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer border border-slate-200"
          >
            Password Vault (1Password)
          </button>
          <button
            type="button"
            onClick={() => loadPreset('ssn_hr')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer border border-slate-200"
          >
            SSN Payroll Record
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Simulated Raw Keystroke / Input Stream:</label>
            <textarea
              rows={2}
              value={sandboxText}
              onChange={(e) => setSandboxText(e.target.value)}
              placeholder="Type sensitive or sample data to test..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Simulated Active Process Executable:</label>
            <input
              type="text"
              value={sandboxProcess}
              onChange={(e) => setSandboxProcess(e.target.value)}
              placeholder="e.g. keepass.exe, chrome.exe"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Simulated Active Window Title:</label>
            <input
              type="text"
              value={sandboxTitle}
              onChange={(e) => setSandboxTitle(e.target.value)}
              placeholder="e.g. Chase Online Banking - Sign In"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Simulation Output Card */}
        {sandboxResult && (
          <div className={`p-4 rounded-xl border space-y-3.5 transition ${
            sandboxResult.is_sensitive
              ? 'bg-purple-50/60 border-purple-200'
              : 'bg-emerald-50/60 border-emerald-200'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200/50 pb-2.5">
              <div className="flex items-center gap-2">
                {sandboxResult.is_sensitive ? (
                  <ShieldAlert className="w-5 h-5 text-purple-700" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                )}
                <span className="font-bold text-xs text-slate-900">
                  {sandboxResult.is_sensitive ? 'Sensitive Activity Intercepted by Privacy Engine' : 'No Sensitive Patterns Detected'}
                </span>
              </div>

              {/* Screen Capture Defense Badge */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600">Screen Capture State:</span>
                {sandboxResult.blocked_capture ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> CAPTURE SUPPRESSED (SCREEN BLACKED OUT)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <Check className="w-3 h-3" /> SCREEN CAPTURE ALLOWED
                  </span>
                )}
              </div>
            </div>

            {/* Sanitized Text Display */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Sanitized / Redacted Output Telemetry:
              </label>
              <div className="p-3 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-800 break-all select-all">
                {sandboxResult.sanitized_text || <span className="text-slate-400 italic">Empty string</span>}
              </div>
            </div>

            {/* Matched DLP Violations */}
            {sandboxResult.matched_reasons && sandboxResult.matched_reasons.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Triggered DLP Reasons &amp; Violations:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {sandboxResult.matched_reasons.map((reason, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-0.5 bg-purple-200/70 text-purple-900 font-mono text-[10px] font-bold rounded border border-purple-300"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backend API Diagnostics */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <Globe className="w-5 h-5 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-900">Backend API Diagnostics</h4>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
          />
          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>{isPinging ? 'Pinging API...' : 'Test Backend /health'}</span>
          </button>
        </div>

        {pingStatus && (
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
            pingStatus.connected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {pingStatus.connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <div>
              <p className="font-bold">
                {pingStatus.connected ? 'FastAPI Service Operational' : 'FastAPI Offline / Using Telemetry Cache'}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {pingStatus.connected
                  ? `Response latency: ${pingStatus.latency}ms • Status: ${pingStatus.data?.status || 'healthy'}`
                  : `Notice: ${pingStatus.error}. Dashboard active via cached telemetry.`
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT DYNAMIC PRIVACY RULE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-900">
                  {editingRule ? `Edit Privacy Rule: ${editingRule.name}` : 'Add New Dynamic Privacy Rule'}
                </h4>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical Record Numbers (MRN)"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={ruleForm.category}
                    onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="regex">Regex Pattern</option>
                    <option value="domain">Blocked Domain</option>
                    <option value="process">Protected Process (.exe)</option>
                    <option value="window_title">Window Title</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Enforcement Action</label>
                  <select
                    value={ruleForm.action}
                    onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="mask_and_block">Mask Text &amp; Suppress Screen</option>
                    <option value="mask">Mask Text Only</option>
                    <option value="block_capture">Suppress Screen Only</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Matching Pattern / Regular Expression</label>
                  {regexError ? (
                    <span className="text-[10px] text-rose-600 font-semibold">Invalid regex syntax</span>
                  ) : ruleForm.pattern ? (
                    <span className="text-[10px] text-emerald-600 font-semibold">Valid regex</span>
                  ) : null}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. \\bMRN-[0-9]{8}\\b or keepass\\.exe"
                  value={ruleForm.pattern}
                  onChange={(e) => {
                    setRuleForm({ ...ruleForm, pattern: e.target.value });
                    validatePattern(e.target.value);
                  }}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-1 ${
                    regexError ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                />
                {regexError && (
                  <p className="text-[10px] text-rose-600 mt-1">{regexError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Replacement Mask</label>
                  <input
                    type="text"
                    placeholder="e.g. [REDACTED_MRN]"
                    value={ruleForm.replacement}
                    onChange={(e) => setRuleForm({ ...ruleForm, replacement: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">DLP Reason Code</label>
                  <input
                    type="text"
                    placeholder="e.g. DLP_MRN_Protected"
                    value={ruleForm.reason}
                    onChange={(e) => setRuleForm({ ...ruleForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Explain the security rationale or compliance standard (e.g. HIPAA, PCI-DSS)..."
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rule_enabled"
                  checked={ruleForm.enabled}
                  onChange={(e) => setRuleForm({ ...ruleForm, enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="rule_enabled" className="font-bold text-slate-700 cursor-pointer">
                  Activate Rule Immediately Across Fleet
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition shadow-sm cursor-pointer"
                >
                  {editingRule ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
