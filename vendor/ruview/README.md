# Origin

KobeOS integrates **RuView** (https://github.com/ruvnet/RuView) as the
WiFi-CSI sensing backend for Kobe Security. RuView ships under the MIT
licence — see `LICENSE` for the full text and upstream attribution. We
don't vendor the Rust/Python source (~hundreds of MB, requires its own
toolchain); instead this folder gives you a one-shot Docker launcher
and a setup script that pulls the official upstream image
(`ruvnet/wifi-densepose:latest`) and exposes its API on:

- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3001`

The KobeSecurity app in KobeOS auto-detects whether RuView is reachable
on those ports and switches between "live" and "simulated" mode without
any code changes.

# One-shot start

From the KobeOS repo root:

```bash
docker compose -f vendor/ruview/docker-compose.yml up -d
```

That pulls the official RuView simulator image and starts it in the
background. Open Kobe Security inside KobeOS — the header turns green
("RuView online · simulated CSI") and the zones / vitals / pose tabs
fill with simulated frames you can use to demo the integration.

To stop it:

```bash
docker compose -f vendor/ruview/docker-compose.yml down
```

# Running with real ESP32 sensors

The Docker image runs RuView's simulation server by default. For a real
ESP32-S3 / Cognitum Seed deployment, follow the upstream guide:

- ESP32 firmware flashing — https://github.com/ruvnet/RuView#esp32-s3-firmware-flash
- Cognitum Seed appliance — https://github.com/ruvnet/RuView#cognitum-seed-appliance

Then point `VITE_RUVIEW_BASE_URL` and `VITE_RUVIEW_WS_URL` in the
KobeOS environment at the appliance instead of `localhost`.

# Configuration knobs

The KobeSecurity app reads these env vars (frontend, baked in at build
time):

| Env var | Default | What |
|---|---|---|
| `VITE_RUVIEW_BASE_URL` | `http://localhost:3000` | RuView HTTP API root |
| `VITE_RUVIEW_WS_URL` | `ws://localhost:3001` | RuView live-frame WebSocket |

# License attribution

RuView is MIT-licensed by `@ruvnet`. The full text is preserved at
`LICENSE` in this directory. Every commit that interacts with the
RuView API carries an acknowledgement in the code comment.
