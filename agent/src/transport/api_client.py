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
                print(f"Telemetry authorization failed: HTTP {res.status_code}")
            else:
                print(f"Telemetry rejected: HTTP {res.status_code}. Check backend service logs.")
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
            if res.status_code != 200:
                print(f"S3 upload rejected: HTTP {res.status_code}")
            return res.status_code == 200
        except requests.exceptions.RequestException as e:
            # Request exceptions can include the signed URL and its credentials.
            print(f"S3 Media upload transport error: {type(e).__name__}")
            return False

    def confirm_media_upload(self, path: str) -> bool:
        # Use the configured API origin; never print the signed upload URL.
        origin = self.server_url.split('/api/v1/')[0]
        try:
            res = requests.post(origin + path, timeout=10)
            if res.status_code != 200:
                print(f"S3 upload verification failed: HTTP {res.status_code}")
            return res.status_code == 200
        except requests.exceptions.RequestException as e:
            print(f"S3 upload verification transport error: {e}")
            return False
