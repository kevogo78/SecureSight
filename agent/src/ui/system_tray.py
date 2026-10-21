from PyQt6.QtWidgets import QSystemTrayIcon, QMenu
from PyQt6.QtCore import pyqtSignal, pyqtSlot, QObject
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
        self.status_action = self.menu.addAction("Status: Active")
        self.status_action.setEnabled(False)
        self.recording_action = self.menu.addAction("Video: Idle; clips every 5 minutes")
        self.recording_action.setEnabled(False)

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

    @pyqtSlot(str)
    def update_recording_status(self, text):
        self.recording_action.setText(f"Video: {text}")
        if text.startswith("Recording"):
            self.tray.setToolTip("SecureSight - Recording screen video")
        else:
            self.tray.setToolTip("SecureSight - Monitoring paused" if self.is_paused else "SecureSight - Monitoring active")
