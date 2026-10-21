import sys
import os
import socket
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QLabel, QCheckBox, 
    QPushButton, QHBoxLayout, QMessageBox, QLineEdit, QFormLayout
)
from PyQt6.QtCore import Qt
from .branding import brand_icon

class ConsentModal(QDialog):
    def __init__(self, default_server_url: str = None):
        super().__init__()
        self.consent_granted = False
        default_url = default_server_url or os.environ.get("EDMT_SERVER_URL", "http://127.0.0.1:8000/api/v1/telemetry")
        self.server_url = default_url
        self.endpoint_name = socket.gethostname()
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("SecureSight — Monitoring Consent")
        self.setWindowIcon(brand_icon())
        self.setFixedSize(520, 360)
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowStaysOnTopHint)

        layout = QVBoxLayout()

        header = QLabel("<h3>System Observability & Consent Agreement</h3>")
        layout.addWidget(header)

        notice_text = (
            "This endpoint is subject to cybersecurity auditing and telemetry monitoring. "
            "Data collected includes active foreground applications, system resource metrics, "
            "keystroke logs (per cybersecurity audit policy), and periodic screen captures.\n\n"
            "• Password fields and credential apps are masked automatically via DLP filters.\n"
            "• Keystroke and session captures can be toggled via fleet administration.\n"
            "• You may pause or revoke consent at any time via the taskbar / menu tray."
        )
        body = QLabel(notice_text)
        body.setWordWrap(True)
        layout.addWidget(body)

        # Connection Settings Form (Allows pointing to AWS EC2 instance IP)
        form = QFormLayout()
        self.server_input = QLineEdit(self.server_url)
        self.server_input.setPlaceholderText("http://<EC2-PUBLIC-IP>:8000/api/v1/telemetry")
        form.addRow("Backend Server URL:", self.server_input)

        self.name_input = QLineEdit(self.endpoint_name)
        self.name_input.setPlaceholderText("Computer Hostname")
        form.addRow("Workstation ID:", self.name_input)
        layout.addLayout(form)

        self.checkbox = QCheckBox("I acknowledge and authorize session monitoring")
        layout.addWidget(self.checkbox)

        btn_layout = QHBoxLayout()
        self.btn_accept = QPushButton("Start Monitoring")
        self.btn_accept.setEnabled(False)
        self.btn_decline = QPushButton("Decline & Exit")

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
