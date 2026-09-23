import io
from PIL import ImageGrab, ImageDraw, ImageFilter

class ScreenCaptureEngine:
    @staticmethod
    def capture_and_redact(bounding_box: dict = None) -> bytes:
        """
        Captures the screen and applies redactions directly in memory.
        Returns:
            bytes: Compressed JPEG buffer.
        """
        screenshot = ImageGrab.grab()

        if bounding_box:
            draw = ImageDraw.Draw(screenshot)
            box = (
                bounding_box["left"],
                bounding_box["top"],
                bounding_box["right"],
                bounding_box["bottom"]
            )
            draw.rectangle(box, fill="black")

        # Downscale slightly to stay within Free Tier bandwidth
        screenshot.thumbnail((1280, 720))
        buffer = io.BytesIO()
        screenshot.save(buffer, format="JPEG", quality=75)
        return buffer.getvalue()