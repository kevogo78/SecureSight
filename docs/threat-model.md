# Threat Model & Privacy Engineering Framework

This document outlines the **Threat Model**, **Data Protection Architecture**, and **Privacy Engineering Safeguards** implemented across the Privacy-Centric Endpoint Observability System (EDMT).

---

## 🎯 Security & Privacy Philosophy

Traditional Employee Monitoring Software (EMS) and endpoint detection agents operate under a surveillance-first paradigm: they indiscriminately record all keystrokes, capture desktop displays, and exfiltrate raw data to centralized cloud databases. This creates substantial legal liability, violates data privacy regulations (GDPR, CCPA/CPRA, HIPAA), and exposes enterprise organizations to credential leakage if cloud repositories are breached.

**EDMT reverses this paradigm** through a **Privacy-First Zero-Knowledge Architecture**:
1. **Local-First Sanitization**: Sensitive data must be stripped at the endpoint *before* network serialization.
2. **User Consent & Autonomy**: Surveillance without explicit authorization is prohibited.
3. **Cryptographic Secrecy**: The cloud infrastructure never stores unencrypted visual media.

---

## 🔍 System Assets & Sensitivity Tiers

| Asset | Sensitivity | Protection Requirement |
| :--- | :--- | :--- |
| **User Keystrokes & Typing** | High / PII | Aggregated into counts-per-minute (KPM). Raw character streams are suppressed from cloud transmission. |
| **Desktop Screenshots** | High / Confidential | Screen buffers redacted in-memory, encrypted with client-side **AES-256-GCM**, and stored as opaque ciphertext in S3. |
| **Credential / Banking Windows** | Critical | Evaluated against blacklists. Complete capture suppression when sensitive processes/titles are active. |
| **Performance Telemetry** | Low / Operational | CPU%, RAM%, disk usage, active application name, and uptime streamed as standard operational metrics. |
| **Admin Database Credentials** | Critical | Stored in `.env` configuration, never committed to version control, hashed with PBKDF2. |

---

## 🌐 Trust Boundaries & Data Flow Diagram

```mermaid
flowchart TD
    subgraph Untrusted Space: End-User Desktop
        USER[User Desktop Applications]
        SENSITIVE[Banking, Credentials, Personal Email]
    end

    subgraph Trusted Client Agent Sandbox
        HOOK[Keyboard & Window Hooks]
        DLP{Local DLP Engine}
        AES[AES-256-GCM Crypto Engine]
    end

    subgraph Boundary 1: Encrypted Network Transit
        TLS[TLS 1.3 / HTTPS Tunnel]
    end

    subgraph Boundary 2: AWS Cloud Infrastructure
        API[FastAPI Ingestion Engine]
        DB[(Amazon RDS PostgreSQL)]
        S3[(Amazon S3 Ciphertext Store)]
    end

    USER -->|Keystrokes & Display| HOOK
    HOOK --> DLP
    SENSITIVE -.->|Blocked / Suppressed| DLP
    DLP -->|Sanitized Metadata| TLS
    DLP -->|Raw Screen Buffer| AES
    AES -->|Ciphertext + IV + Tag| TLS
    TLS --> API
    API -->|Metadata Logs| DB
    API -->|Direct Presigned S3 Stream| S3
```

---

## 🛡️ STRIDE Threat Assessment

The system has been evaluated against the **STRIDE** threat modeling framework:

### 1. Spoofing (Identity Impersonation)
- **Threat**: A rogue device attempts to inject malicious telemetry by spoofing an authorized endpoint ID.
- **Mitigations**:
  - The backend verifies endpoint registration state.
  - Telemetry validation is enforced through strict Pydantic schemas.
  - Endpoints can be revoked instantly by administrators via the `/endpoints/{id}/kick` control.

### 2. Tampering (Data Modification)
- **Threat**: Telemetry packets or screenshot files are intercepted and modified during transit.
- **Mitigations**:
  - All transport is conducted over TLS/HTTPS terminated at NGINX.
  - Screenshots use **AES-256-GCM authenticated encryption**, where any ciphertext alteration triggers a tag authentication failure upon decryption.
  - Telemetry payloads compute SHA-256 file hashes stored in PostgreSQL.

### 3. Repudiation (Disavowal of Actions)
- **Threat**: An administrative user denies viewing captured employee screens, or an employee disputes application usage.
- **Mitigations**:
  - Immutable audit logs in PostgreSQL record timestamped event entries (`timestamp`, `log_id`, `endpoint_id`, `active_app`, `filter_status`).
  - Screen access requests are logged with administrative user identities.

### 4. Information Disclosure (Data Leakage)
- **Threat**: Passwords, SSNs, credit card numbers, or proprietary business data leak via screenshots or keystroke logs.
- **Mitigations**:
  - **Real-Time Regex DLP**: Built-in pattern matchers sanitize credit card numbers (Luhn pattern), Social Security Numbers (SSN regex), and common password input patterns.
  - **Window Title Blacklist**: Matches banking websites (Chase, Bank of America, Wells Fargo), password managers (1Password, Bitwarden, KeePass), and credential dialogues.
  - **Privacy Suspension State**: Immediately pauses capture and sets `filter_status = "Title_Blacklisted"`.
  - **Private S3 Buckets**: Public access is completely blocked (`BlockPublicAccess = True`). Access requires presigned URLs with short-lived expiration windows (300 seconds).

### 5. Denial of Service (DoS)
- **Threat**: A compromised agent floods the FastAPI backend with massive payloads or excessive screenshot uploads.
- **Mitigations**:
  - Rate limiting and fixed polling intervals (`10,000ms` cycle).
  - Screenshots are throttled to 1 per 6 cycles (`60 seconds`).
  - Upload URLs are restricted to `10 MB` payload size maximums.
  - S3 lifecycle policies automatically purge old captures after 30 days to prevent storage exhaustion.

### 6. Elevation of Privilege
- **Threat**: An unauthorized user accesses administrative controls to kick workstations or view sensitive audit data.
- **Mitigations**:
  - Role-Based Access Control (RBAC) separates **Administrator** and **Auditor** roles in PostgreSQL.
  - The agent architecture is strictly **read-only telemetry**; the backend cannot execute remote code or arbitrary shell commands on client endpoints.

---

## ⚖️ Privacy Principles & Compliance Alignment

### Explicit Informed Consent (GDPR Article 6 / CCPA)
Workstations cannot be monitored invisibly. The agent:
1. Presents an interactive **Consent Authorization Modal** before recording any data.
2. Displays a persistent icon in the Windows/macOS System Tray.
3. Provides an immediate **"Pause Monitoring Consent"** action, placing the user in control of privacy during personal breaks.

### Data Minimization (GDPR Article 5)
Only metrics strictly required for security compliance are collected:
- Aggregate keystroke frequency (KPM) rather than raw keystroke character sequences.
- Active foreground application and window title (redacted if blacklisted).
- CPU and RAM performance consumption.

