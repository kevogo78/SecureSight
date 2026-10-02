import requests

class TelemetryAPIClient:
    def __init__(self, server_url: str):
        self.server_url = server_url

    def transmit_telemetry(self, payload: dict) -> dict:
        try:
            res = requests.post(self.server_url, json=payload, timeout=5)
            if res.status_code == 200:
                return res.json()
            elif res.status_code in (401, 403):
                return {"status": "kicked"}
        except requests.exceptions.RequestException as e:
            print(f"Transport error: {e}")
        return None

    @staticmethod
    def upload_encrypted_media(presigned_url: str, encrypted_bytes: bytes) -> bool:
        try:
            res = requests.put(
                presigned_url,
                data=encrypted_bytes,
                headers={"Content-Type": "application/octet-stream"},
                timeout=10
            )
            return res.status_code == 200
        except requests.exceptions.RequestException as e:
            print(f"S3 Media upload error: {e}")
            return False