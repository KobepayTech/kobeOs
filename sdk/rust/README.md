# sdk/rust

Rust SDK for KobeOS runtime integration.

This crate will provide:
- IPC bindings to the KobeOS runtime (HAL, services, drivers)
- Safe wrappers for hardware access (audio, camera, USB, Bluetooth)
- Async HTTP client for the KobeOS backend API

## Status

Scaffold — implementation pending the Rust core runtime.

## Planned crate structure

```
sdk/rust/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── hal.rs        # Hardware abstraction bindings
│   ├── audio.rs      # Audio service client
│   ├── ai.rs         # AI service client
│   └── http.rs       # Backend HTTP client
```

## Usage (planned)

```rust
use kobeos_sdk::KobeRuntime;

#[tokio::main]
async fn main() {
    let rt = KobeRuntime::connect().await.unwrap();
    let volume = rt.audio().get_volume().await.unwrap();
    println!("Volume: {volume}%");
}
```
