import time
import psutil
from pynput import keyboard

class ActivityTracker:
    def __init__(self):
        self.keystroke_counter = 0
        self.listener = None
        self._is_running = False

    def _on_press(self, key):
        # Increment counter without recording the key character
        self.keystroke_counter += 1

    def start(self):
        self._is_running = True
        self.listener = keyboard.Listener(on_press=self._on_press)
        self.listener.daemon = True
        self.listener.start()

    def get_and_reset_activity(self):
        count = self.keystroke_counter
        self.keystroke_counter = 0
        return count

    def get_system_metrics(self):
        return {
            "cpu_percent": psutil.cpu_percent(interval=None),
            "ram_percent": psutil.virtual_memory().percent
        }

    def stop(self):
        self._is_running = False
        if self.listener:
            self.listener.stop()