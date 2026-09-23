from PyQt6.QtWidgets import QSystemTrayIcon, QMenu
from PyQt6.QtGui import QIcon, QPixmap, QColor
from PyQt6.QtCore import pyqtSignal, QObject

class SystemTrayManager(QObject):
    stop_requested = pyqtSignal()
    pause_requested = pyqtSignal(bool)

    def __init__(self, app):
        super().__init__()
        self.app = app
        self.is_paused = False

        # Generate a lightweight programatic status icon
        pixmap = QPixmap(16, 16)
        pixmap.fill(QColor("green"))
        self.tray = QSystemTrayIcon(QIcon(pixmap), self.app)

        self.menu = QMenu()
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
        if self.is_paused:
            self.status_action.setText("Status: Suspended (User)")
            self.pause_action.setText("Resume Monitoring")
        else:
            self.status_action.setText("Status: Active")
            self.pause_action.setText("Pause (15 mins)")
        self.pause_requested.emit(self.is_paused)

    def update_status_text(self, text: str):
        self.status_action.setText(f"Status: {text}")