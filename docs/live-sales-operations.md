# Live sales operations

## Broadcast from KobeOS

Open a live-selling session for a connected Instagram or TikTok account, then expand **Broadcast from KobeOS**. Paste the stream URL and key issued by the platform's live producer, start the camera broadcast, check the platform preview, then confirm **Go Live** there. End the video on the platform before stopping the camera. Leaving the session stops camera capture; the server also stops after 30 seconds without video.

Instagram documents the stream-key workflow at https://about.instagram.com/blog/tips-and-tricks/instagram-live-producer. TikTok documents encoder URL/key setup at https://webcast.tiktokv.com/falcon/webcast_mt/page/obs_intro/index.html. Access depends on the platform and account. KobeOS does not generate provider keys or grant LIVE access.

Chrome/Edge on HTTPS must support WebM MediaRecorder and camera/microphone capture. The server uses the pinned `ffmpeg-static` platform binary, or `FFMPEG_BIN` for an administrator-managed installation. Keys are transient process arguments; they are not saved in the database, browser storage, audit entries, or API responses. OS administrators can inspect process arguments. The encoder accepts only Instagram/TikTok RTMP destinations. Failure requires a fresh camera broadcast and key entry; it never reports the platform publicly live merely because the encoder started.

| Setting | Default | Meaning |
| --- | --- | --- |
| `LIVE_BROADCAST_MAX` | 2 | Simultaneous camera encoders per API process; one per owner |
| `TIKTOK_LIVE_MAX_CONNECTIONS` | 50 | Automatic TikTok comment connections per process |
| `TIKTOK_LIVE_MAX_PER_OWNER` | 2 | Automatic TikTok comment connections per owner |
| `TIKTOK_LIVE_CONNECTOR_ENABLED` | true | Set false to use an external comment bridge instead |

The TikTok dependency is an unofficial public-chat connector. Treat availability as best effort, not an official TikTok API guarantee. For multiple API replicas, enable the automatic connector on one worker only; caps are per process. Each connection queues at most 500 comments. The camera uploader stops after three queued chunks rather than accumulating video in memory.

## Product photo repair

Migration `1789000000000-ProductPhotoRepair` adds the nullable `pos_products.photoRepair` JSONB column. Production must run migrations; do not enable schema synchronization. New and edited products are checked on write. Existing products are checked on their next catalog read. The result is saved with the source references, timestamp, and unresolved URLs. Unchanged references are not looked up again after cache expiry or server restart.

Open **Product photo repair report** in Live Sales to see saved unresolved references. Restore the missing source asset and choose **Retry repair**, or replace the photo in ERP. A deleted image's bytes cannot be recreated. External and foreign-owner references are never published as owned assets. Concurrent gallery edits are preserved with a conditional update.

## Windows release and rollback

Runtime dependencies are stored under `server/runtime-deps/<platform>-<architecture>-<Node ABI>-<lockfile hash>`. Each release's `dist/node_modules` is a directory junction to its immutable dependency set. Unchanged dependencies are reused. A new set is staged with robocopy and marked complete before use. Release cleanup removes the junction itself, never its target. Current and previous releases retain their exact dependency versions.

The release preflight encodes a WebP image and executes FFmpeg before touching the running API. Dependency caches are intentionally retained for rollback. Operators can remove an old cache only after confirming no retained release junction points to it. The first release after a dependency change still copies the new dependency tree.

The Windows release still requires the self-hosted origin PC to be online. Changes to the release workflow trigger it on master. Backend health checks and rollback run before public pages are published. A successful recovery workflow is not evidence that a new release was installed.

## Verification

- Backend unit tests exercise connection caps, owner isolation, ordered chunks, durable image misses, explicit retry, and concurrent edits.
- The encoder integration test converts generated WebM video/audio through the real service encoder to local H.264/AAC FLV. It never contacts a streaming platform.
- `server/test/live-sales.e2e-spec.ts` exercises a bridge comment → reservation → checkout data → order → stock decrement, duplicate conversion protection, and owner-scoped photo repair against test PostgreSQL.
- Live acceptance still requires a real authorized account: complete sign-in, start a phone or camera broadcast, pin a test product, receive a real platform comment, verify the reservation and checkout, then end the test. Record the installed commit and results. Do not equate local tests with this live acceptance test.
