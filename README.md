# OBS Xbox Focus Fix

Automatically removes the **"Click or tap here to continue playing"** overlay from **Xbox Remote Play** running inside an **OBS Browser Source**.

The project uses the **Chrome DevTools Protocol (CDP)** exposed by OBS Browser Sources to reproduce Chromium's **Emulate a focused page** behaviour.

---

## Features

* Automatic Xbox Browser Source discovery
* No hardcoded Browser Source IDs
* Chrome DevTools Protocol integration
* Automatic reconnection after page reload
* Optional watch mode
* No OBS plugin required
* Lightweight Node.js script

---

## Why?

When Xbox Remote Play loses focus inside an OBS Browser Source, Xbox displays the following overlay:

> Click or tap here to continue playing

This makes it impossible to interact with OBS, Twitch Dashboard or other streaming tools without interrupting gameplay.

This project automates Chromium's **Focus Emulation**, allowing Xbox Remote Play to remain active while interacting with other applications.

---

## Requirements

* OBS Studio
* Browser Source enabled
* Node.js 20+
* Xbox Remote Play running inside an OBS Browser Source

OBS must be started with:

```text
--remote-debugging-port=9222
--remote-allow-origins=http://localhost:9222
```

---

## Installation

```bash
npm install
```

---

## Usage

```bash
node obs-xbox-focus-fix.js --watch
```

Available options:

```text
--watch
--port
--timeout
--interval
```

---

## How it works

1. Query `http://localhost:9222/json`
2. Find the Xbox Remote Play Browser Source
3. Connect to its DevTools WebSocket
4. Enable Chromium Focus Emulation
5. Keep the CDP session alive
6. Automatically reconnect if the page reloads

---

## Project structure

```
obs-xbox-focus-fix/
│
├── src/
│   └── obs-xbox-focus-fix.js
│
├── LICENSE
└── README.md
```

---

## Limitations

This project relies on:

* OBS Browser Source (CEF)
* Chrome DevTools Protocol
* Xbox Remote Play Web

Future updates to OBS, Chromium or Xbox Remote Play may require adjustments.

---

## Contributing

Issues, Pull Requests and suggestions are welcome.

If you find another use case for Chromium Focus Emulation inside OBS Browser Sources, feel free to contribute.

---

## License

MIT

