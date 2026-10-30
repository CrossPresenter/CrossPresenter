# CrossPresenter Remote (Android)

The phone in your pocket becomes the presentation clicker: next/previous slide,
black out the projector, clear text, stop the output, jump to any song, and
search the library — over the local Wi-Fi, with no cloud account and no internet
round trip.

This is a Flutter app for Android (iOS is planned). It talks directly to the
CrossPresenter desktop app over a WebSocket on the LAN.

## Why it feels instant

- The socket stays open for the whole service; tapping a control writes one
  small JSON frame. There is no HTTP handshake, no cloud relay, and no polling.
- The desktop applies the command against its existing store and broadcasts a
  fresh state snapshot. The phone renders that snapshot, so what you see is
  exactly what the projector is doing.
- The app measures round-trip time with a ping every 5 seconds and shows it in
  the header. On a normal home/venue Wi-Fi this is typically 2–20 ms; "0 ms" on
  a screen would be a lie, but the perceived delay is below one frame.
- A dropped link reconnects automatically with backoff and keeps the last slide
  on screen, so a brief Wi-Fi hiccup does not throw you back to a pairing form.

## Pairing

1. Put the laptop and phone on the same Wi-Fi network.
2. On the laptop: **Settings → Remote Control → Show pairing QR**.
3. In the app, tap **Scan pairing QR**. The link is remembered; the next launch
   reconnects automatically.

The QR contains a `crosspresenter://pair?host=…&port=…&token=…&name=…` link. The
token is a bearer credential, stored in Android's Keystore-backed secure storage
on the phone. If you ever need to revoke every phone, rotate the token on the
desktop and rescan.

Manual entry is available for networks where the camera is inconvenient: the
desktop's IP, port (`37645` by default), and the token shown next to the QR.

## Run it

```powershell
flutter pub get
flutter run                 # phone or emulator
flutter test                # protocol unit tests
flutter build apk --release # build/app/outputs/flutter-apk/app-release.apk
```

### Try it without the desktop app

A fake desktop that speaks the same protocol lives in `tool/fake_server.dart`:

```powershell
dart run tool/fake_server.dart
```

It listens on port `37645` with token `dev-token`, prints a pairing link, and
implements next/previous, project, black, clear, stop, and library search.

- **Android emulator:** host `10.0.2.2`, port `37645`, token `dev-token`
  (the emulator reaches the host machine through `10.0.2.2`).
- **Physical phone:** use the PC's LAN IP printed by the fake server and put the
  phone on the same Wi-Fi.

## Project layout

```
lib/
  core/protocol.dart      # wire format: hello/state/ack/err/library/pong
  core/remote_client.dart # WebSocket, reconnect, RTT, command helpers
  core/storage.dart       # remembered desktop + secure token storage
  state/providers.dart    # Riverpod providers
  ui/connect_screen.dart  # QR / last desktop / manual entry
  ui/qr_scan_screen.dart  # camera scanner, accepts only pairing links
  ui/remote_screen.dart   # live slide, transport, black/clear/stop, service
  ui/library_screen.dart  # debounced server-side song search
  ui/theme.dart           # app palette and shared card
tool/fake_server.dart     # development stand-in for the desktop
test/widget_test.dart     # protocol and pairing URI tests
```

The protocol is deliberately small and versioned (`protocolVersion = 1`). Every
message is one JSON object; unknown fields are ignored, unknown message types
are ignored, and the desktop closes with code `4002` if the versions do not
match. The matching Rust implementation lives in
`../CrossPresenter-Windows_11/src-tauri/src/remote/`.

## Security model (v1)

- The listener is on the LAN and requires the pairing token in the WebSocket
  URL; an invalid token is rejected before the socket is upgraded.
- The token is 24 random bytes, never sent to a third party. There is no cloud
  service in the path.
- v1 uses cleartext WebSocket (`ws://`) because both ends are on the same
  network and the payload is song titles, not secrets. TLS with a self-signed
  certificate and certificate pinning is on the roadmap for venues with
  untrusted Wi-Fi.
- The desktop should only be running the remote listener when the operator
  wants it; the Settings panel shows exactly which phones are connected.

## Roadmap

- mDNS/Bonjour discovery by service type `_crosspresenter._tcp`, plus a
  six-digit PIN flow so a discovered desktop can be paired without the camera.
- Slide preview thumbnails (the protocol already reserves a `preview` message).
- Bible reference entry and the timer/overlay controls.
- Multi-desktop switching for operators with a primary and backup machine.
- iOS build and App Store/TestFlight packaging.
