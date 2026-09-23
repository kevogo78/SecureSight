import sys
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QLabel, QCheckBox, 
    QPushButton, QHBoxLayout, QMessageBox
)
from PyQt6.QtCore import Qt

class ConsentModal(QDialog):
    def __init__(self):
        super().__init__()
        self.consent_granted = False
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("Endpoint Monitoring & Privacy Authorization")
        self.setFixedSize(480, 260)
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowStaysOnTopHint)

        layout = QVBoxLayout()

        header = QLabel("<h3>System Observability & Consent Agreement</h3>")
        layout.addWidget(header)

        notice_text = (
            "This machine is subject to diagnostic and security monitoring. "
            "Data collected includes general application names, hardware usage metrics, "
            "and periodic activity frequency.\n\n"
            "• Keystroke characters are NOT recorded.\n"
            "• Password fields and credential apps are masked automatically.\n"
            "• You may revoke consent at any time via the taskbar tray."
        )
        body = QLabel(notice_text)
        body.setWordWrap(True)
        layout.addWidget(body)

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
        self.accept()