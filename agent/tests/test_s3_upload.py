from unittest.mock import patch

import requests

from src.transport.api_client import TelemetryAPIClient


def response(status, body=b"", headers=None):
    result = requests.Response()
    result.status_code = status
    result._content = body
    result.headers.update(headers or {})
    return result


def test_upload_preserves_signed_url_and_headers():
    url = "https://bucket.s3.us-east-1.amazonaws.com/file.enc?X-Amz-Signature=private"
    with patch("src.transport.api_client.requests.put", return_value=response(200)) as put:
        assert TelemetryAPIClient.upload_encrypted_media(url, b"encrypted")
    put.assert_called_once_with(url, data=b"encrypted",
                                headers={"Content-Type": "application/octet-stream"},
                                timeout=10, allow_redirects=False)


def test_access_denied_reports_code_without_signing_material(capsys):
    xml = b"""<Error><Code>AccessDenied</Code><Message>private-message</Message>
    <RequestId>ABC123</RequestId><CanonicalRequest>private-signature</CanonicalRequest></Error>"""
    with patch("src.transport.api_client.requests.put", return_value=response(403, xml)):
        assert not TelemetryAPIClient.upload_encrypted_media("https://example.invalid", b"data")
    out = capsys.readouterr().out
    assert "AccessDenied" in out
    assert "ABC123" in out
    assert "s3:PutObject" in out
    assert "private" not in out


def test_namespaced_xml_and_region_hint(capsys):
    xml = b'<Error xmlns="urn:s3"><Code>SignatureDoesNotMatch</Code></Error>'
    with patch("src.transport.api_client.requests.put", return_value=response(
            403, xml, {"x-amz-bucket-region": "us-west-2"})):
        assert not TelemetryAPIClient.upload_encrypted_media("https://example.invalid", b"data")
    out = capsys.readouterr().out
    assert "SignatureDoesNotMatch" in out
    assert "us-west-2" in out


def test_non_xml_response_does_not_print_body(capsys):
    with patch("src.transport.api_client.requests.put", return_value=response(403, b"private-proxy-error")):
        assert not TelemetryAPIClient.upload_encrypted_media("https://example.invalid", b"data")
    assert "private" not in capsys.readouterr().out


def test_transport_exception_does_not_print_signed_url(capsys):
    with patch("src.transport.api_client.requests.put", side_effect=requests.RequestException("private-signature")):
        assert not TelemetryAPIClient.upload_encrypted_media("https://example.invalid", b"data")
    assert "private" not in capsys.readouterr().out


def test_redirect_is_reported_without_replaying_signed_request(capsys):
    with patch("src.transport.api_client.requests.put", return_value=response(
            307, headers={"x-amz-bucket-region": "us-west-2"})):
        assert not TelemetryAPIClient.upload_encrypted_media("https://example.invalid", b"data")
    assert "HTTP 307" in capsys.readouterr().out
