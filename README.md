# Voltix Remote Studio

Voltix Remote Studio is a professional LAN TV remote application for LG webOS, Samsung Tizen, and Roku devices. The control logic is kept in the backend JavaScript modules, while the interface lives in separate HTML, CSS, and renderer JavaScript files so the visual layer can be edited without rebuilding the protocol code.

## Application information

Name: Voltix Remote Studio  
Created: April 2026  
Current build date: May 2026  
Developer: Christopher Ryan  
Contact: christopher.ryan@live.com  
Copyright: © 2026 Christopher Ryan. All rights reserved.

Contact developer for questions or comments.

## Project layout

```text
app/src/backend/       TV discovery, pairing, saved keys, and command routing
app/src/renderer/      Editable user interface files
app/src/server.js      Local HTTP/SSE bridge between the UI and backend logic
run.sh                 Starts the local server and opens the desktop app window
```

## Operational notes

Voltix sends LG, Samsung, and Roku commands through real local-network control paths. The animated interface is visual feedback for real user actions; protocol responses still come from the connected device or from the mock protocol tests.

Pairing keys, remembered devices, and browser profile data are written under:

```text
~/.config/VoltixRemoteStudio/
```

On first launch, Voltix can copy an existing local pairing store if one is present, so a previously working pairing key can be preserved.

## Developer checks

Protocol and syntax checks:

```bash
./run_protocol_tests.sh
```

HTTP UI smoke check:

```bash
./run_http_smoke.sh
```
