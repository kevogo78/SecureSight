"""SecureSight artwork shared by source and PyInstaller builds."""
import sys
from pathlib import Path

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QIcon, QPainter, QPixmap


def brand_icon():
    root = Path(sys._MEIPASS) if hasattr(sys, "_MEIPASS") else Path(__file__).resolve().parents[2]
    artwork = QPixmap(str(root / "assets" / "securesight-logo.png"))
    if artwork.isNull():
        raise RuntimeError("SecureSight logo is missing from the agent assets directory")
    # Frame the shield/lock from the original artwork for small tray sizes.
    shield = artwork.copy(int(artwork.width() * .155), int(artwork.height() * .16),
                          int(artwork.width() * .20), int(artwork.height() * .67))
    icon = QIcon()
    for size in (16, 20, 24, 32, 48, 64, 128, 256):
        canvas = QPixmap(size, size)
        canvas.fill(Qt.GlobalColor.transparent)
        scaled = shield.scaled(size, size, Qt.AspectRatioMode.KeepAspectRatio,
                               Qt.TransformationMode.SmoothTransformation)
        painter = QPainter(canvas)
        painter.drawPixmap((size - scaled.width()) // 2, (size - scaled.height()) // 2, scaled)
        painter.end()
        icon.addPixmap(canvas)
    return icon
