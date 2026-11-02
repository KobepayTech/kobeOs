# What is the core code of KobeOS?

KobeOS is mainly TypeScript and JavaScript. Both Windows editions share the same
desktop and business applications; their AI configuration and model choices differ.

| Part | Source | What it does |
| --- | --- | --- |
| Desktop | `src/os/Desktop.tsx` | Draws the desktop and opens applications. |
| Windows and state | `src/os/WindowManager.tsx`, `src/os/store.ts` | Tracks open windows, settings and desktop state. |
| App catalogue | `src/os/registry.ts` | Registers the available business applications. |
| Windows application | `electron/main.cjs` | Starts the app, local database, backend and AI engine. |
| Safe desktop bridge | `electron/preload.cjs` | Exposes controlled computer features to the interface. |
| Runtime services | `electron/runtime/` | Coordinates devices, files, local services and AI access. |
| Business server | `server/src/main.ts`, `server/src/app.module.ts` | Starts authenticated APIs for shops, orders, payments and other business modules. |
| AI coordination | `server/src/ai/ai.service.ts` | Routes prompts to the configured model and handles replies. |
| Core verification | `electron/core-integrity.js` | Checks packaged runtime files against the build manifest. |
| Build configuration | `package.json` | Defines the version, dependencies and installer targets. |

React implements the interface, Electron hosts the Windows desktop application,
and NestJS implements the business server. PostgreSQL stores business records.
Qwen is the AI model, rather than the core of KobeOS itself. Replacing the model
does not require replacing the desktop or business applications.

The bootable edition uses a Linux kernel; this repository is primarily the
business desktop platform and its installation tools, rather than a custom kernel.

## The two Windows editions

- **Full KobeOS:** the complete application suite with the standard AI catalogue
  and support for installing additional models.
- **KobeOS Qwen 3:** the same application suite, restricted to Qwen 3-VL 8B for
  chat, coding, translation and image understanding. The intended offline model
  pack uses Q4_K_M quantization. Extra embedding, Whisper and background-removal
  models are disabled in this edition.

The Qwen installer does not contain the model weights. Its offline model pack is
separate, keeping application updates smaller. Both desktop installers include an
AI engine; users do not need to install Ollama separately.
