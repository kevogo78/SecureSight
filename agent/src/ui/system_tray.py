from PyQt6.QtWidgets import QSystemTrayIcon, QMenu
from PyQt6.QtCore import pyqtSignal, QObject
from .branding import brand_icon

class SystemTrayManager(QObject):
    stop_requested = pyqtSignal()
    pause_requested = pyqtSignal(bool)

    def __init__(self, app):
        super().__init__()
        self.app = app
        self.is_paused = False

        self.tray = QSystemTrayIcon(brand_icon(), self.app)
        self.tray.setToolTip("SecureSight — Monitoring active")

        self.menu = QMenu()
        self.menu.setStyleSheet("""
            QMenu {
                background-color: #07130c;
                color: #f8fafc;
                border: 1px solid #1e293b;
                border-radius: 8px;
                padding: 6px;
                font-family: 'Segoe UI', -apple-system, sans-serif;
                font-size: 12px;
            }
            QMenu::item {
                padding: 6px 16px;
                border-radius: 6px;
                color: #cbd5e1;
            }
            QMenu::item:selected {
                background-color: #064e3b;
                color: #34d399;
            }
            QMenu::item:disabled {
                color: #64748b;
                font-weight: 700;
            }
        """)
        self.status_action = self.menu.addAction("Status: Active")
        self.status_action.setEnabled(False)

        self.pause_action = self.menu.addAction("Pause (15 mins)")
        self.pause_action.triggered.connect(self.toggle_pause)

        self.stop_action = self.menu.addAction("Stop & Revoke Consent")
        self.stop_action.triggered.connect(self.stop_requested.emit)

        self.tray.setContextMenu(self.menu)
        self.tray.show()

    def toggle_pause(self):
        self.is_paused = not self.is_paused
        self.tray.setToolTip("SecureSight — Monitoring paused" if self.is_paused else "SecureSight — Monitoring active")
        if self.is_paused:
            self.status_action.setText("Status: Suspended (User)")
            self.pause_action.setText("Resume Monitoring")
        else:
            self.status_action.setText("Status: Active")
            self.pause_action.setText("Pause (15 mins)")
        self.pause_requested.emit(self.is_paused)

    def update_status_text(self, text: str):
        self.status_action.setText(f"Status: {text}")
