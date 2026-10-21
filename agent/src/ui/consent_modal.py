import sys
import os
import socket
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QLabel, QCheckBox, 
    QPushButton, QHBoxLayout, QMessageBox, QLineEdit, QFormLayout, QFrame
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QPalette, QColor
from .branding import brand_icon

MODAL_STYLESHEET = """
QDialog {
    background-color: #07130c;
    color: #f8fafc;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
}

QLabel {
    color: #f8fafc;
    background: transparent;
}

QFrame#privacyCard {
    background-color: #0a1c12;
    border: 1px solid #065f46;
    border-radius: 10px;
    padding: 12px;
}

QLineEdit {
    background-color: #020617;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 8px 12px;
    color: #ffffff;
    font-size: 12px;
    selection-background-color: #059669;
}

QLineEdit:focus {
    border: 1px solid #10b981;
    background-color: #05140d;
}

QLineEdit::placeholder {
    color: #475569;
}

QCheckBox {
    color: #cbd5e1;
    font-size: 12px;
    spacing: 8px;
    font-weight: 500;
}

QCheckBox::indicator {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid #334155;
    background-color: #020617;
}

QCheckBox::indicator:hover {
    border: 1px solid #10b981;
}

QCheckBox::indicator:checked {
    background-color: #10b981;
    border: 1px solid #10b981;
    image: none;
}

QPushButton#btn_decline {
    background-color: #1e293b;
    color: #94a3b8;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 9px 18px;
    font-size: 12px;
    font-weight: 600;
}

QPushButton#btn_decline:hover {
    background-color: #334155;
    color: #ffffff;
    border: 1px solid #475569;
}

QPushButton#btn_accept {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #059669, stop:1 #10b981);
    color: #020617;
    border: none;
    border-radius: 8px;
    padding: 9px 22px;
    font-size: 12px;
    font-weight: 700;
}

QPushButton#btn_accept:hover {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #10b981, stop:1 #34d399);
}

QPushButton#btn_accept:disabled {
    background: #1e293b;
    color: #475569;
    border: 1px solid #1e293b;
}
"""

class ConsentModal(QDialog):
    def __init__(self, default_server_url: str = None):
        super().__init__()
        self.consent_granted = False
        default_url = default_server_url or os.environ.get("EDMT_SERVER_URL", "http://127.0.0.1:8000/api/v1/telemetry")
        self.server_url = default_url
        self.endpoint_name = socket.gethostname()
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("SecureSight - Monitoring Consent")
        self.setWindowIcon(brand_icon())
        self.setFixedSize(560, 620)
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowStaysOnTopHint)
        self.setStyleSheet(MODAL_STYLESHEET)

        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(14)

        # Header with branding badge
        header_badge = QLabel("SECURESIGHT • ITEC 4810 CAPSTONE")
        header_badge.setStyleSheet("color: #34d399; font-size: 10px; font-weight: 800; letter-spacing: 1px;")
        layout.addWidget(header_badge)

        title = QLabel("System Observability & Consent Agreement")
        title.setStyleSheet("color: #ffffff; font-size: 18px; font-weight: 800; margin-bottom: 2px;")
        layout.addWidget(title)

        subtitle = QLabel(
            "This endpoint is enrolled in automated cybersecurity auditing and fleet observability. "
            "Monitoring includes active applications, resource metrics, keystroke logs, periodic "
            "screenshots, and automatic 15-second screen recordings every 5 minutes "
            "(default screen, no audio). Encrypted captures are uploaded for administrator review."
        )
        subtitle.setWordWrap(True)
        subtitle.setStyleSheet("color: #94a3b8; font-size: 12px; line-height: 1.4;")
        layout.addWidget(subtitle)

        # Privacy Policy Box (styled card)
        privacy_card = QFrame()
        privacy_card.setObjectName("privacyCard")
        card_layout = QVBoxLayout(privacy_card)
        card_layout.setContentsMargins(14, 12, 14, 12)
        card_layout.setSpacing(8)

        item1 = QLabel("<b>• Privacy Filters:</b> Known sensitive applications, titles, and input patterns suppress capture. Not every sensitive field can be detected.")
        item1.setWordWrap(True)
        item1.setStyleSheet("color: #a7f3d0; font-size: 11px;")
        card_layout.addWidget(item1)

        item2 = QLabel("<b>• Keystroke Auditing:</b> Keystroke text is collected in audit logs with the agent's privacy filters, alongside aggregate input intensity (KPM).")
        item2.setWordWrap(True)
        item2.setStyleSheet("color: #a7f3d0; font-size: 11px;")
        card_layout.addWidget(item2)

        item3 = QLabel("<b>• Revocable Consent:</b> Recording status is visible in the tray. Pause or revoke monitoring there to cancel an in-progress clip.")
        item3.setWordWrap(True)
        item3.setStyleSheet("color: #a7f3d0; font-size: 11px;")
        card_layout.addWidget(item3)

        layout.addWidget(privacy_card)

        # Configuration form
        form_frame = QFrame()
        form_layout = QFormLayout(form_frame)
        form_layout.setContentsMargins(0, 4, 0, 4)
        form_layout.setSpacing(10)

        lbl_server = QLabel("BACKEND SERVER URL")
        lbl_server.setStyleSheet("color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;")
        self.server_input = QLineEdit(self.server_url)
        self.server_input.setPlaceholderText("http://<EC2-PUBLIC-IP>:8000/api/v1/telemetry")
        form_layout.addRow(lbl_server, self.server_input)

        lbl_name = QLabel("WORKSTATION HOSTNAME")
        lbl_name.setStyleSheet("color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;")
        self.name_input = QLineEdit(self.endpoint_name)
        self.name_input.setPlaceholderText("Computer Hostname")
        form_layout.addRow(lbl_name, self.name_input)

        layout.addWidget(form_frame)

        # Consent acknowledgment checkbox
        self.checkbox = QCheckBox("I acknowledge and authorize session telemetry for this workstation")
        self.checkbox.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(self.checkbox)

        # Action Buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(12)
        btn_layout.addStretch()

        self.btn_decline = QPushButton("Decline & Exit")
        self.btn_decline.setObjectName("btn_decline")
        self.btn_decline.setCursor(Qt.CursorShape.PointingHandCursor)

        self.btn_accept = QPushButton("Start Monitoring")
        self.btn_accept.setObjectName("btn_accept")
        self.btn_accept.setEnabled(False)
        self.btn_accept.setCursor(Qt.CursorShape.PointingHandCursor)

        self.checkbox.toggled.connect(lambda checked: self.btn_accept.setEnabled(checked))
        self.btn_accept.clicked.connect(self.on_accept)
        self.btn_decline.clicked.connect(self.reject)

        btn_layout.addWidget(self.btn_decline)
        btn_layout.addWidget(self.btn_accept)
        layout.addLayout(btn_layout)

        self.setLayout(layout)

    def on_accept(self):
        self.consent_granted = True
        url = self.server_input.text().strip()
        if url:
            self.server_url = url
        name = self.name_input.text().strip()
        if name:
            self.endpoint_name = name
        self.accept()
