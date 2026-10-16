"""Offline signing checks using dummy credentials; no AWS requests."""
import importlib
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import boto3
from botocore.config import Config


class SigningTests(unittest.TestCase):
    def test_upload_uses_v4_and_matches_agent_content_type(self):
        with patch("boto3.client"):
            helper = importlib.import_module("src.utils.s3_helper")
        client = boto3.client(
            "s3", region_name="us-east-1", config=Config(signature_version="s3v4"),
            aws_access_key_id="offline-key", aws_secret_access_key="offline-secret",
        )
        with patch.object(helper, "s3_client", client), patch.object(helper, "S3_BUCKET", "offline-bucket"):
            with patch.object(client, "generate_presigned_url", wraps=client.generate_presigned_url) as sign:
                url = helper.generate_upload_url("screenshots/42/test.enc")
        args = sign.call_args.kwargs
        self.assertEqual(args["Params"]["ContentType"], "application/octet-stream")
        query = parse_qs(urlsplit(url).query)
        self.assertEqual(query["X-Amz-Algorithm"], ["AWS4-HMAC-SHA256"])
        self.assertEqual(query["X-Amz-SignedHeaders"], ["content-type;host"])
        self.assertEqual(query["X-Amz-Expires"], ["300"])


if __name__ == "__main__":
    unittest.main()
