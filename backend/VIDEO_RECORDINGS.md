# SecureSight recorded clips

Implemented on the feature branch, not automatically deployed to EC2.
This adds genuine H.264/yuv420p MP4 recordings of the default screen, using
imageio-ffmpeg's bundled executable. There is no audio capture or live stream.

## Behavior

- After the expanded monitoring consent is accepted, the first 15-second clip
  starts about 1.5 seconds after agent startup; later attempts start every five
  minutes. Frames are captured at 2 FPS and fitted within a 1280x720 canvas.
- One background worker handles recording, encryption, upload, and confirmation.
  Overlapping attempts are skipped; clips are never queued indefinitely.
- Frames and MP4 bytes stay in memory. The MP4 is encrypted using the existing
  AES-256-GCM engine/key before it leaves the agent. No raw video is saved to disk.
- The tray exposes recording/upload/idle status. Pause, revoke, shutdown, or a
  detected sensitive foreground app/title cancels the partial clip. Unknown
  foreground detection fails closed. A cancelled clip is not published for playback.
- A PUT already in flight cannot be recalled by cancelling: encrypted objects
  may remain pending, but cancellation prevents their completion/publication.
- Detection uses the existing process/title filters and title-pattern checks.
  It is not OCR and cannot guarantee that all sensitive visible content is masked.
  Do not use real secrets in demonstrations.
- Screenshot capture frequency and the keylogging implementation are unchanged.

## Database preparation

Run `database/video_recordings.sql` on the existing application database after
backing up the working deployment. It creates one table and index referencing
endpoints. It does not replace screenshot tables, use telemetry_logs, or require
aws_main.py. Deploy the current `src.main:app` backend.

Do not run an earlier alternative aws_endpoint_registry.sql migration for this.
The database role needs SELECT/INSERT/UPDATE on video_recordings.

## Backend

- POST /api/v1/recordings/upload-url validates metadata/registered active endpoint
  and creates a pending row plus a five-minute signed octet-stream PUT URL.
- POST /api/v1/recordings/{uuid}/complete verifies the S3 encrypted object size,
  then marks the record uploaded. Failed/pending uploads are excluded from lists.
- GET /api/v1/recordings?endpoint_id=... lists uploaded clips for signed-in admins.
- GET /api/v1/recordings/{uuid}/video validates the admin cookie, fetches/decrypts
  at most 16 MiB, checks AES authentication and plaintext SHA-256, and returns
  uncached video/mp4. The frontend downloads a bounded clip into a blob URL,
  then the browser provides play/pause/seek/fullscreen. Blob URLs are revoked
  when changing clips or closing the dialog.

The signing identity needs s3:PutObject and s3:GetObject for recordings/* in the
existing S3_BUCKET (plus existing KMS permissions where applicable). Keep the
bucket private. Existing SCREENSHOT_KEY_HEX and dashboard admin session settings
are reused. No FFmpeg is needed on EC2: encoding happens on the endpoint.
The existing agent ingestion/upload endpoints do not authenticate devices;
this follows that model. Admin playback does require the real server session.

## Local dependencies and tests

The Windows agent requires the added imageio-ffmpeg==0.6.0 dependency. Install
only that new dependency into your already working environment if the rest are
installed; avoid reinstalling the old backend pins on EC2 Python 3.14.

```powershell
.\.venv311\Scripts\python.exe -m pip install imageio-ffmpeg==0.6.0
cd agent
..\.venv311\Scripts\python.exe -m pytest -q
cd ..\backend
..\.venv311\Scripts\python.exe -m pytest tests/test_recordings.py tests/test_media_viewing.py -q
```

Tests use generated frames, dummy keys, mocked S3/database, and actual FFmpeg
encode/decode. They do not capture the desktop or contact AWS. Tests do not
replace applying/validating the migration against your RDS schema.

PyInstaller builds must include `--collect-all imageio_ffmpeg` as well as the
existing logo assets/config. The macOS build script is updated. Rebuild existing
agent EXEs to distribute recording; an old EXE cannot record automatically.

## End-to-end demonstration

1. Preserve a current backup as in DASHBOARD_SCREENSHOTS.md. Keep recordings
   separate from your partner's main-branch work until integration is reviewed.
2. Apply the additive SQL migration to a test database, or to RDS during the
   coordinated deployment. Verify IAM access to recordings/*.
3. Stage and test the changed backend. Restart the live backend only after the
   staged checks pass. Deploy the rebuilt dashboard from dashboard/dist.
4. Start the updated agent and accept the expanded consent on your own test PC.
   Video is on by default after consent; no hidden start occurs before consent.
   Set SECURESIGHT_VIDEO_ENABLED=false in the agent environment to disable video.
5. Use a harmless application/title during recording. Check tray recording state.
   Expect `Encrypted video uploaded and verified (...)` after the clip uploads.
6. Verify an object under recordings/<endpoint-id>/<uuid>.mp4.enc and a matching
   uploaded row in video_recordings. Select the endpoint and Video Recordings in
   the dashboard, then play/pause/seek the real MP4.
7. Pause during a new clip and verify it is discarded. Revoke consent and verify
   no further recording starts. Test wrong-key, missing-object, and signed-out
   errors without displaying plaintext. Existing screenshots must still work.

The dashboard controls formerly changed browser storage only. They now describe
the actual agent policy rather than claim to remotely start/stop recording.
Do not expect new APIs on the existing EC2 deployment before deployment: 404
means the backend has not been updated; 503 may mean migration/DB access missing.

## Storage and rollback

There is no automatic retention job in this implementation. For a limited demo,
monitor recording sizes and remove demo recordings through a coordinated cleanup
of S3 objects and their DB rows. Pending uploads may leave encrypted orphan objects.
Configure S3 lifecycle/DB cleanup together if recurring use is planned. Neither
pause nor logout deletes previously uploaded evidence.

To roll back, stop the updated agent (or set SECURESIGHT_VIDEO_ENABLED=false),
restore the pre-video backend/frontend/environment backup, and restart the old
service. Leave the additive table/data in place; do not drop tables or delete
captures as part of code rollback. Preserve the backup containing your secrets.

Use HTTPS and secure cookies for admin use; HTTP-IP is only the current test
setup. The added feature is a bounded demo recorder, not enterprise surveillance.
