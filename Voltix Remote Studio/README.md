<p align="center">
  <img src="assets/voltix-logo.png" alt="Voltix Remote Studio" width="760">
</p>

<p align="center">
  <strong>Powered Remote Control Studio</strong>
</p>

# Voltix Remote Studio

Voltix Remote Studio is a local desktop smart-TV remote control app for Linux. It opens as a dedicated Chrome/Chromium app window and lets you find, connect to, and control supported TVs on the same local network.

The app is designed for LAN control, not cloud control. The control server runs on your computer, the browser window displays the remote UI, and commands are sent directly from your machine to the selected TV.

## What the app does

Voltix Remote Studio provides a polished desktop control surface for supported smart TVs. It can:

- search the local network for supported TVs
- save manual TV IP addresses
- reconnect to the last saved TV
- connect to LG webOS, Roku, and Samsung TVs when the TV accepts the connection
- send remote-control commands through the real TV protocol for that brand
- send text input to TVs that support text entry
- show connection and command status in a human-readable log
- show current app/media information when the connected TV exposes it
- keep pairing keys, tokens, manual hosts, and last-device history in the user config folder

The app does not require an internet account for normal local remote-control use.

## Supported TV control paths

### LG webOS

LG TVs are controlled through the LG webOS websocket protocol. On first connection, the TV may show a pairing prompt. Approve the prompt on the TV once; Voltix saves the LG client key for future connections.

Supported LG actions include directional control, OK/Enter, Back, Home, Info, Settings/Menu, Input, volume, mute, channel controls, playback controls, number keys, color keys, power off, app launch, toast messages, text entry, and Enter for text input when the TV accepts those commands.

LG media display uses available webOS app/status information. Depending on the TV and current app, the TV may expose app title, foreground app ID, and launch artwork. It does not guarantee full live show metadata for every source.

### Roku

Roku devices are controlled through Roku External Control Protocol on the local network. Roku discovery and command control use the Roku HTTP control endpoints.

Supported Roku actions include directional control, Select/OK, Back, Home, Info, volume, mute, channel controls, playback controls, power commands when supported, number-key text literals, text entry, app launch, active-app lookup, and channel icon lookup.

### Samsung

Samsung TVs are controlled through the Samsung remote websocket path. Some TVs may show a pairing/authorization prompt or require the TV to allow remote control from the computer.

Supported Samsung actions include directional control, OK/Enter, Back, Home, Info, Settings/Menu, volume, mute, channel controls, playback controls, power, and number keys. Universal live artwork is not exposed by the Samsung remote protocol used in this build.

## What is not supported

The UI may show brand labels for Apple TV, Sony, Hisense, TCL, or VIZIO as visual placeholders, but those adapters are not implemented in this build. Unsupported brands are disabled or hidden instead of pretending to work.

Voltix does not fabricate TV media data. If the TV does not expose artwork, title, progress, or show information, the Now Playing panel shows a clean fallback.

Voltix does not include payment, subscription, cloud login, app-store distribution, or fake unlock features.

## Requirements

Install these on the Linux computer that will run Voltix:

- Node.js
- Google Chrome or Chromium
- a supported TV on the same local network

On Ubuntu/Kubuntu, install the basic runtime packages with:

```bash
sudo apt update
sudo apt install -y nodejs chromium
```

If you use Google Chrome instead of Chromium, `run.sh` will use Chrome automatically when it finds it.

## Quick start

Extract the package, enter the app folder, and run the launcher:

```bash
tar -xzf voltix_remote_studio_v3_3_tailwind_ui_rebuild.tar.gz
cd "Voltix Remote Studio"
chmod +x run.sh
./run.sh
```

On BlackBird, a clean project location is:

```bash
mkdir -p /mnt/dev-storage/projects/voltix
cp ~/Downloads/voltix_remote_studio_v3_3_tailwind_ui_rebuild.tar.gz /mnt/dev-storage/projects/voltix/
cd /mnt/dev-storage/projects/voltix
tar -xzf voltix_remote_studio_v3_3_tailwind_ui_rebuild.tar.gz
cd "Voltix Remote Studio"
chmod +x run.sh
./run.sh
```

## Desktop launcher

To add Voltix Remote Studio to your Linux application menu, run:

```bash
./install_desktop_launcher.sh
```

That script writes this launcher file:

```text
~/.local/share/applications/voltix-remote-studio.desktop
```

The launcher points to the local `run.sh` script in the extracted app folder.

## How to use the app

1. Start Voltix with `./run.sh`.
2. Make sure your TV and computer are on the same local network.
3. Use **Auto Search Network** to scan for supported TVs.
4. Select a discovered TV, or save a manual IP address if discovery does not find it.
5. Approve any pairing prompt shown on the TV.
6. Use the remote buttons to send commands.
7. Use **Refresh** in Now Playing to ask the connected TV for current media/app information.
8. Use **Connect Last TV** after a TV has been saved once.

## Manual IP addresses

If network discovery does not find the TV, enter the TV IP address in the Manual Host field and save it. Voltix includes saved manual hosts in later search/probe passes.

Manual hosts, pairing keys, tokens, and last-device data are stored in:

```text
~/.config/VoltixRemoteStudio/smart-remote-studio.json
```

The browser profile used by the app window is stored in:

```text
~/.config/VoltixRemoteStudio/browser-profile/
```

The server log is written to:

```text
~/.config/VoltixRemoteStudio/voltix-remote-studio.log
```

## Local network behavior

Voltix runs a local Node.js server bound to `127.0.0.1`. The Chrome/Chromium app window opens that local server as the UI.

The local server then communicates with TVs on your LAN using the supported TV protocol:

```text
run.sh -> Node local server -> browser app window -> API calls -> TV protocol client -> TV
```

The app uses local discovery and probing to find supported TVs:

- SSDP search on local IPv4 network interfaces
- Roku ECP probe on port `8060`
- LG webOS probe on ports `3000` and `3001`
- Samsung remote probe on ports `8001` and `8002`

Discovery and control depend on your network, firewall, TV settings, and whether the TV allows remote control from the computer.

## Interface overview

The main window contains:

- **TV Finder**: brand filter, network scan, manual IP entry, saved-device reconnection, and discovered device list
- **Remote**: real command buttons wired to the connected TV brand’s supported command map
- **Now Playing**: current app/media information when the TV provides it
- **Tooling / Status**: human-readable scan, connection, command, media, and error messages
- **Footer**: app identity, theme/about control, and clock

Buttons that are not available for the connected brand are disabled rather than faked.

## Project structure

```text
Voltix Remote Studio/
├── README.md
├── run.sh
├── install_desktop_launcher.sh
├── run_http_smoke.sh
├── run_protocol_tests.sh
├── app/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── scripts/
│   │   ├── syntax_check.js
│   │   └── mock_smoke.js
│   ├── tests/
│   │   ├── clients.test.js
│   │   └── mock_servers.js
│   └── src/
│       ├── server.js
│       ├── backend/
│       │   ├── config.js
│       │   ├── controller.js
│       │   ├── discovery.js
│       │   ├── http.js
│       │   ├── lg.js
│       │   ├── log.js
│       │   ├── roku.js
│       │   ├── samsung.js
│       │   └── xml.js
│       └── renderer/
│           ├── index.html
│           ├── renderer.js
│           ├── style.css
│           └── tailwind.input.css
```

## Main files

`run.sh` starts the local Node server, waits for the assigned local port, then opens Chrome/Chromium in app-window mode.

`app/src/server.js` serves the UI, exposes local HTTP API routes, opens the server-sent-events status stream, and connects UI actions to the controller hub.

`app/src/backend/discovery.js` scans/probes the local network and returns supported TV devices.

`app/src/backend/controller.js` chooses the correct TV client for the selected device.

`app/src/backend/lg.js` contains LG webOS pairing, command, pointer-button, app-launch, text, and now-playing logic.

`app/src/backend/roku.js` contains Roku ECP connection, keypress, app launch, text input, active-app, and icon lookup logic.

`app/src/backend/samsung.js` contains Samsung websocket connection, token handling, and remote-key command logic.

`app/src/backend/config.js` stores pairing keys, Samsung tokens, manual hosts, and last-device history.

`app/src/renderer/index.html` defines the visible app layout.

`app/src/renderer/renderer.js` owns UI state, click events, command dispatch, media refresh, status rendering, voice-command mapping, and unavailable-button behavior.

`app/src/renderer/style.css` is the built browser stylesheet used by the app.

`app/src/renderer/tailwind.input.css` is the Tailwind source stylesheet used to generate the browser stylesheet.

## Test commands

Run the available test scripts from the app folder root:

```bash
node app/scripts/syntax_check.js
node app/scripts/mock_smoke.js
./run_protocol_tests.sh
./run_http_smoke.sh
```

The mock smoke test starts mock LG, Roku, and Samsung servers and verifies client behavior without requiring a physical TV.

The HTTP smoke test starts the local server and verifies that the UI and `/api/state` endpoint respond.

Physical TV behavior still depends on real TV firmware, network settings, pairing prompts, and local firewall rules.

## Troubleshooting

### The app says Chrome/Chromium is missing

Install Chromium or Chrome:

```bash
sudo apt install -y chromium
```

### The app says Node.js is missing

Install Node.js:

```bash
sudo apt install -y nodejs
```

### No TVs are found

Check that the TV and computer are on the same local network. Make sure the TV is awake and remote-control access is allowed in the TV settings. Try adding the TV IP address manually, then scan again.

### LG connects but waits for pairing

Look at the TV screen and approve the pairing prompt. After approval, Voltix saves the client key in the user config file.

### Samsung does not connect

Make sure Samsung remote control access is allowed on the TV. Some Samsung models require approving the computer on the TV screen before remote commands work.

### Roku does not connect

Make sure Roku control from mobile apps/local network devices is allowed. Roku control normally uses port `8060` on the local network.

### Now Playing has no artwork

That means the connected TV did not return artwork for the current source. Voltix shows real data only; it does not invent posters or show metadata.

## Development notes

The UI and control logic are intentionally separated. Change UI layout and styling in the renderer files. Do not move TV discovery, pairing, or command logic into the renderer.

Tailwind was used as a build tool for the UI stylesheet. The app loads the generated CSS at runtime and does not need Tailwind running while the app is open.

## Ownership and support

For questions, support, or licensing inquiries, contact the developer.

© 2026 Christopher Ryan. All rights reserved.
