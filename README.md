# OBS Xbox Focus Fix

Automatically prevents the **"Click or tap here to continue playing"** overlay from appearing when Xbox Remote Play loses focus inside an OBS Browser Source.

The script connects to OBS Browser through the **Chrome DevTools Protocol** and enables Chromium's focus emulation for the Xbox page.

No keyboard input, mouse movement or fake activity is generated.

---

## Why?

Xbox Remote Play displays a full-screen overlay as soon as its page loses focus:

> Click or tap here to continue playing

This becomes problematic when Remote Play is embedded directly into OBS.

Clicking anywhere else — OBS, Discord, Twitch Dashboard or another application — causes the Xbox page to lose focus and interrupts the captured image.

OBS Xbox Focus Fix reproduces Chromium's **Emulate a focused page** behavior automatically.

---

## Features

- Automatic Xbox Remote Play target discovery
- No hardcoded DevTools target ID
- Chromium focus emulation through CDP
- Persistent DevTools connection
- Automatic reconnection after page reloads
- No OBS plugin required
- No simulated keyboard or mouse input
- Compatible with a single Xbox Browser Source reused across multiple scenes

---

## Requirements

- OBS Studio with Browser Source support
- Node.js 20 or newer
- Xbox Remote Play running through `xbox.com/play`
- OBS launched with remote debugging enabled

---

## Installation

Clone the repository:

```bash
git clone https://github.com/pooley/obs-xbox-focus-fix.git
cd obs-xbox-focus-fix
```

Install dependencies:

```bash
npm install
```

---

## Start OBS with remote debugging

OBS Browser must expose its Chrome DevTools Protocol endpoint.

Launch OBS with:

```text
--remote-debugging-port=9222
--remote-allow-origins=http://localhost:9222
```

Example on Windows:

```bat
"C:\Program Files\obs-studio\bin\64bit\obs64.exe" ^
  --remote-debugging-port=9222 ^
  --remote-allow-origins=http://localhost:9222
```

You can verify that the endpoint is available by opening:

```text
http://localhost:9222/json
```

The Xbox Browser Source should appear as a page target whose URL contains:

```text
xbox.com/.../play
```

---

## Usage

Start the script in persistent watch mode:

```bash
npm start
```

Equivalent command:

```bash
node obs-xbox-focus-fix.js --watch
```

The script waits for the Xbox Browser Source, enables focus emulation and keeps the DevTools session attached.

Example output:

```text
[info] 🎮 Recherche de la Browser Source Xbox sur localhost:9222 (timeout 60s)...
[success] ✅ Focus emulation activé sur "Xbox Remote Play on Xbox.com" (https://www.xbox.com/.../play)
[info] 🔗 Session CDP attachée sur "Xbox Remote Play on Xbox.com" — connexion maintenue ouverte
```

Stop the script with:

```text
Ctrl+C
```

---

## Command-line options

```text
--watch
```

Keeps the CDP session open and reconnects if the Xbox page reloads.

```text
--port <number>
```

Changes the DevTools port.

Default: `9222`

```text
--timeout <seconds>
```

Sets how long the script waits for OBS and the Xbox Browser Source.

Default: `60`

```text
--interval <seconds>
```

Sets the interval used to verify that the persistent session is still alive.

Default: `5`

---

## Recommended OBS setup

Use **one single Xbox Browser Source**.

Do not create a second independent Browser Source pointing to the same Xbox URL.

Instead, add the original source to every required scene using OBS's **Add existing** option.

Recommended structure:

```text
LIVE
└── Xbox Browser Source

BRB
└── Xbox Browser Source (existing source)
```

This keeps:

- one Chromium page
- one Xbox authentication context
- one Remote Play session
- one DevTools target
- one persistent CDP connection

It also allows the Browser Source to be selected directly from either scene and opened through OBS's **Interact** command.

---

## Why not use a nested scene?

OBS does not expose the internal Browser Sources of a nested scene from its parent scene.

If the Xbox Browser Source is only contained inside a nested scene, you must open that nested scene before using **Interact**.

Adding the same existing Browser Source directly to both `LIVE` and `BRB` avoids this limitation.

---

## BRB workflow

The Xbox Browser Source can remain visually hidden behind the BRB overlay while still being directly selectable from the source list.

Example:

```text
BRB
├── BRB overlay
└── Xbox Browser Source
```

The Xbox source may be:

- placed underneath the BRB overlay
- transformed or cropped independently in the BRB scene
- selected from the source list
- opened with **Interact** when Remote Play requires attention

This makes it possible to:

- extend an inactive Remote Play session
- reconnect to the console
- dismiss Xbox dialogs
- perform maintenance while the BRB screen remains visible to viewers

---

## Audio behavior

OBS audio controls belong to the source itself.

Because `LIVE` and `BRB` reuse the same existing Browser Source, its mute and volume state are shared across both scenes.

Typical workflow:

```text
LIVE → audio enabled
BRB  → mute the Xbox source manually
LIVE → unmute the Xbox source
```

The visual transform remains scene-specific, but the audio state does not.

At the moment, manual mute/unmute is the simplest reliable solution without adding further automation.

---

## Important: avoid creating two Xbox Browser Sources

During testing, running two independent Browser Sources that both attempted to initialize Xbox Remote Play at the same time was followed by gateway and CDN errors, such as:

```text
504 Gateway Time-out
Microsoft-Azure-Application-Gateway/v2
```

and:

```text
An error occurred while processing your request.
errors.edgesuite.net
```

This is an observation, not a confirmed cause: it may come from simultaneous Remote Play session initialization, a temporary Xbox service issue, or an unrelated upstream CDN failure. Regardless of the exact cause, reusing one Browser Source as an existing source avoids the parallel-session scenario entirely.

---

## Browser Source properties

For the Xbox source, avoid enabling options that recreate or reload the page during scene changes.

Recommended:

```text
Shutdown source when not visible: disabled
Refresh browser when scene becomes active: disabled
```

Keeping the Browser Source alive preserves:

- the Xbox login session
- the Remote Play connection
- the DevTools target
- the persistent focus-emulation session

---

## How it works

The script queries the OBS Browser debugging endpoint:

```text
http://localhost:9222/json
```

It searches for a target matching:

```js
target.type === "page" &&
target.url.includes("xbox.com") &&
target.url.includes("/play")
```

It then connects to the target's `webSocketDebuggerUrl` and sends:

```js
await send("Page.enable", {});
await send("Page.bringToFront", {});
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
```

The WebSocket session remains open because the Xbox page may revert to its original behavior when the DevTools client disconnects.

If the page reloads or the target is recreated, watch mode searches for the new target and reconnects automatically.

---

## What this project does not do

This project does not:

- modify Xbox Remote Play
- inject code into Xbox servers
- simulate keyboard activity
- send ghost inputs such as `F13`
- move the mouse periodically
- force the Xbox window to remain in the foreground
- bypass Microsoft authentication
- create or manage Remote Play sessions

It only changes how Chromium reports page focus to the loaded Xbox page.

---

## Alternative workarounds

Other approaches commonly used by streamers include:

### Keeping Xbox focused

Simple, but prevents normal interaction with OBS, Discord or Twitch Dashboard.

### AutoHotkey scripts

Some scripts periodically focus the Xbox window or send an artificial input.

This can interfere with other applications and does not address the actual focus state reported by Chromium.

### Ghost inputs

An unused key such as `F13` may be sent periodically to simulate user activity.

This is intrusive and can create unpredictable interactions with the operating system or other software.

### Third-party Remote Play clients

Alternative clients may avoid parts of the official Xbox web experience, but require an additional application and do not integrate directly into OBS Browser Source.

### Capture card or second PC

A hardware capture workflow avoids browser focus entirely, but increases setup complexity, power usage and hardware requirements.

---

## Limitations

The project depends on:

- OBS Browser Source (CEF)
- Chrome DevTools Protocol
- Xbox Remote Play Web

Updates to OBS, Chromium or Xbox.com may require changes.

The script also does not prevent Xbox's own inactivity or session-expiration mechanisms. Those dialogs may still require manual interaction through OBS.

---

## Project structure

```text
obs-xbox-focus-fix/
├── obs-xbox-focus-fix.js
├── logger.js
├── package.json
├── LICENSE
└── README.md
```

---

## Development

Run once without keeping the CDP connection open:

```bash
node obs-xbox-focus-fix.js
```

Run in watch mode:

```bash
node obs-xbox-focus-fix.js --watch
```

Use another debugging port:

```bash
node obs-xbox-focus-fix.js --watch --port 9333
```

---

## Contributing

Issues, bug reports and pull requests are welcome.

Useful contributions include:

- compatibility reports across OBS versions
- Xbox URL matching improvements
- macOS or Linux testing
- more resilient target-reload detection
- documentation improvements

Please avoid contributions based on continuous fake keyboard or mouse input. The goal of the project is to solve the focus problem through Chromium rather than simulated user activity.

---

## Disclaimer

This is an unofficial community project.

It is not affiliated with, endorsed by or supported by Microsoft, Xbox or the OBS Project.

Xbox, Xbox Remote Play and related trademarks belong to Microsoft.

Use this project at your own risk.

---

## License

MIT
