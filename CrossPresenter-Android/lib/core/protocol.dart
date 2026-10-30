/// Wire protocol for the CrossPresenter remote control (v1).
///
/// This file is the Flutter mirror of the desktop server's messages. Keep it in
/// step with `CrossPresenter-Windows_11/src-tauri/src/remote/protocol.rs`:
/// every field is camelCase and every message is a single JSON object.
library;

import 'dart:convert';

/// Current protocol version. The desktop rejects mismatches with close code
/// 4002 so an old APK can never send commands a newer server misinterpreted.
const int protocolVersion = 1;

/// Default port the desktop server binds to. The QR code always carries the
/// actual port, so this is only the manual-entry default.
const int defaultRemotePort = 37645;

/// Actions the v1 server understands.
abstract final class RemoteActions {
  static const slideNext = 'slide.next';
  static const slidePrev = 'slide.prev';
  static const slideGoto = 'slide.goto';
  static const itemProject = 'item.project';
  static const liveBlack = 'live.black';
  static const liveClearText = 'live.clearText';
  static const liveClearBackground = 'live.clearBackground';
  static const liveStop = 'live.stop';
  static const librarySearch = 'library.search';
  static const bibleProject = 'bible.project';
  static const audioStop = 'audio.stop';
  static const audioLoop = 'audio.loop';
  static const overlayTimerStart = 'overlay.timer.start';
  static const overlayTimerPause = 'overlay.timer.pause';
  static const overlayTimerReset = 'overlay.timer.reset';
}

/// Where and how to reach one desktop. Built from a QR scan or manual entry.
class PairTarget {
  const PairTarget({
    required this.host,
    required this.port,
    required this.token,
    this.name,
  });

  final String host;
  final int port;
  final String token;
  final String? name;

  /// Parse `crosspresenter://pair?host=…&port=…&token=…&name=…`.
  ///
  /// Returns null for anything that is not a complete pairing link, so a
  /// random QR code (a URL, a Wi-Fi password) is ignored instead of producing
  /// a broken connection attempt.
  static PairTarget? fromPairingUri(String raw) {
    final uri = Uri.tryParse(raw.trim());
    if (uri == null) return null;
    if (uri.scheme != 'crosspresenter' || uri.host != 'pair') return null;

    final host = uri.queryParameters['host']?.trim();
    final token = uri.queryParameters['token']?.trim();
    if (host == null || host.isEmpty || token == null || token.isEmpty) {
      return null;
    }
    final port =
        int.tryParse(uri.queryParameters['port'] ?? '') ?? defaultRemotePort;
    if (port <= 0 || port > 65535) return null;
    return PairTarget(
      host: host,
      port: port,
      token: token,
      name: uri.queryParameters['name'],
    );
  }

  /// The control WebSocket for this desktop and this phone.
  Uri controlUri({required String deviceId, required String deviceName}) {
    return Uri(
      scheme: 'ws',
      host: host,
      port: port,
      path: '/control',
      queryParameters: {'token': token, 'device': deviceId, 'name': deviceName},
    );
  }

  Map<String, dynamic> toJson() => {
    'host': host,
    'port': port,
    'name': name,
    // The token is stored separately in secure storage, never in prefs.
  };
}

// ---------------------------------------------------------------------------
// Server -> client messages
// ---------------------------------------------------------------------------

sealed class ServerMessage {
  const ServerMessage();
}

class HelloMessage extends ServerMessage {
  const HelloMessage({
    required this.protocol,
    required this.appVersion,
    required this.serverName,
    required this.capabilities,
  });

  final int protocol;
  final String appVersion;
  final String serverName;
  final List<String> capabilities;
}

class StateMessage extends ServerMessage {
  const StateMessage(this.state);
  final RemoteState state;
}

class AckMessage extends ServerMessage {
  const AckMessage({
    required this.id,
    required this.seq,
    required this.rev,
    this.serverTime,
  });

  final String id;
  final int seq;
  final int rev;
  final int? serverTime;
}

class CommandErrorMessage extends ServerMessage {
  const CommandErrorMessage({
    required this.id,
    required this.code,
    required this.message,
  });

  final String id;
  final String code;
  final String message;
}

class LibraryMessage extends ServerMessage {
  const LibraryMessage({required this.queryId, required this.songs});
  final String queryId;
  final List<LibrarySong> songs;
}

class PongMessage extends ServerMessage {
  const PongMessage({required this.clientTime, required this.serverTime});
  final int clientTime;
  final int serverTime;
}

class PreviewMessage extends ServerMessage {
  const PreviewMessage({
    required this.slideId,
    required this.mime,
    required this.width,
    required this.height,
    required this.data,
  });

  final String slideId;
  final String mime;
  final int width;
  final int height;
  final String data;
}

/// Parse one frame. Unknown message types are ignored (forward compatibility)
/// rather than treated as protocol errors.
ServerMessage? parseServerMessage(Object? raw) {
  if (raw is! Map) return null;
  final map = raw.cast<String, dynamic>();
  switch (map['type']) {
    case 'hello':
      return HelloMessage(
        protocol: _int(map['protocol']),
        appVersion: _str(map['appVersion']),
        serverName: _str(map['serverName'], 'CrossPresenter'),
        capabilities: _strings(map['capabilities']),
      );
    case 'state':
      return StateMessage(RemoteState.fromJson(map));
    case 'ack':
      return AckMessage(
        id: _str(map['id']),
        seq: _int(map['seq']),
        rev: _int(map['rev']),
        serverTime: map['serverT'] is num ? _int(map['serverT']) : null,
      );
    case 'err':
      return CommandErrorMessage(
        id: _str(map['id']),
        code: _str(map['code'], 'error'),
        message: _str(map['message'], 'The desktop rejected that command.'),
      );
    case 'library':
      return LibraryMessage(
        queryId: _str(map['queryId']),
        songs: _maps(map['songs']).map(LibrarySong.fromJson).toList(),
      );
    case 'pong':
      return PongMessage(
        clientTime: _int(map['t']),
        serverTime: _int(map['serverT']),
      );
    case 'preview':
      return PreviewMessage(
        slideId: _str(map['slideId']),
        mime: _str(map['mime'], 'image/jpeg'),
        width: _int(map['w']),
        height: _int(map['h']),
        data: _str(map['data']),
      );
    default:
      return null;
  }
}

String encodeCommand({
  required String id,
  required int seq,
  required String action,
  Map<String, dynamic> args = const {},
}) {
  return jsonEncode({
    'type': 'cmd',
    'id': id,
    'seq': seq,
    'action': action,
    'args': args,
    't': DateTime.now().millisecondsSinceEpoch,
  });
}

String encodePing({required int clientTime}) {
  return jsonEncode({'type': 'ping', 't': clientTime});
}

// ---------------------------------------------------------------------------
// State snapshots
// ---------------------------------------------------------------------------

class RemoteState {
  const RemoteState({
    required this.rev,
    required this.show,
    required this.live,
    required this.slide,
    required this.audio,
    required this.overlays,
    required this.monitors,
  });

  final int rev;
  final ShowSummary show;
  final LiveSnapshot live;
  final SlideSnapshot? slide;
  final AudioSnapshot audio;
  final List<OverlaySnapshot> overlays;
  final List<MonitorSnapshot> monitors;

  static const empty = RemoteState(
    rev: 0,
    show: ShowSummary.empty,
    live: LiveSnapshot.empty,
    slide: null,
    audio: AudioSnapshot.empty,
    overlays: [],
    monitors: [],
  );

  factory RemoteState.fromJson(Map<String, dynamic> json) {
    final slide = json['slide'];
    return RemoteState(
      rev: _int(json['rev']),
      show: ShowSummary.fromJson(_map(json['show'])),
      live: LiveSnapshot.fromJson(_map(json['live'])),
      slide: slide is Map
          ? SlideSnapshot.fromJson(slide.cast<String, dynamic>())
          : null,
      audio: AudioSnapshot.fromJson(_map(json['audio'])),
      overlays: _maps(json['overlays']).map(OverlaySnapshot.fromJson).toList(),
      monitors: _maps(json['monitors']).map(MonitorSnapshot.fromJson).toList(),
    );
  }
}

class ShowSummary {
  const ShowSummary({required this.title, required this.items});

  final String title;
  final List<ShowItemSummary> items;

  static const empty = ShowSummary(title: '', items: []);

  factory ShowSummary.fromJson(Map<String, dynamic> json) {
    return ShowSummary(
      title: _str(json['title']),
      items: _maps(json['items']).map(ShowItemSummary.fromJson).toList(),
    );
  }
}

class ShowItemSummary {
  const ShowItemSummary({
    required this.id,
    required this.title,
    required this.kind,
    required this.slideCount,
  });

  final String id;
  final String title;
  final String kind;
  final int slideCount;

  factory ShowItemSummary.fromJson(Map<String, dynamic> json) {
    return ShowItemSummary(
      id: _str(json['id']),
      title: _str(json['title'], 'Untitled'),
      kind: _str(json['kind'], 'song'),
      slideCount: _int(json['slideCount']),
    );
  }
}

class LiveSnapshot {
  const LiveSnapshot({
    required this.active,
    required this.itemId,
    required this.slideId,
    required this.itemTitle,
    required this.slideIndex,
    required this.slideCount,
    required this.blank,
    required this.clearText,
    required this.clearBackground,
  });

  final bool active;
  final String? itemId;
  final String? slideId;
  final String? itemTitle;
  final int slideIndex;
  final int slideCount;
  final bool blank;
  final bool clearText;
  final bool clearBackground;

  static const empty = LiveSnapshot(
    active: false,
    itemId: null,
    slideId: null,
    itemTitle: null,
    slideIndex: 0,
    slideCount: 0,
    blank: false,
    clearText: false,
    clearBackground: false,
  );

  factory LiveSnapshot.fromJson(Map<String, dynamic> json) {
    return LiveSnapshot(
      active: _bool(json['active']),
      itemId: _nullableString(json['itemId']),
      slideId: _nullableString(json['slideId']),
      itemTitle: _nullableString(json['itemTitle']),
      slideIndex: _int(json['slideIndex']),
      slideCount: _int(json['slideCount']),
      blank: _bool(json['blank']),
      clearText: _bool(json['clearText']),
      clearBackground: _bool(json['clearBackground']),
    );
  }
}

class SlideSnapshot {
  const SlideSnapshot({
    required this.id,
    required this.label,
    required this.lines,
    required this.nextLine,
  });

  final String id;
  final String label;
  final List<String> lines;
  final String? nextLine;

  factory SlideSnapshot.fromJson(Map<String, dynamic> json) {
    return SlideSnapshot(
      id: _str(json['id']),
      label: _str(json['label']),
      lines: _strings(json['lines']),
      nextLine: _nullableString(json['nextLabel']),
    );
  }
}

class AudioSnapshot {
  const AudioSnapshot({
    required this.playing,
    required this.title,
    required this.loop,
  });

  final bool playing;
  final String? title;
  final bool loop;

  static const empty = AudioSnapshot(playing: false, title: null, loop: false);

  factory AudioSnapshot.fromJson(Map<String, dynamic> json) {
    return AudioSnapshot(
      playing: _bool(json['playing']),
      title: _nullableString(json['title']),
      loop: _bool(json['loop']),
    );
  }
}

class OverlaySnapshot {
  const OverlaySnapshot({
    required this.id,
    required this.kind,
    required this.running,
    required this.remainingMs,
  });

  final String id;
  final String kind;
  final bool running;
  final int remainingMs;

  factory OverlaySnapshot.fromJson(Map<String, dynamic> json) {
    return OverlaySnapshot(
      id: _str(json['id']),
      kind: _str(json['kind'], 'timer'),
      running: _bool(json['running']),
      remainingMs: _int(json['remainingMs']),
    );
  }
}

class MonitorSnapshot {
  const MonitorSnapshot({
    required this.id,
    required this.name,
    required this.width,
    required this.height,
  });

  final String id;
  final String name;
  final int width;
  final int height;

  factory MonitorSnapshot.fromJson(Map<String, dynamic> json) {
    return MonitorSnapshot(
      id: _str(json['id']),
      name: _str(json['name'], 'Display'),
      width: _int(json['width']),
      height: _int(json['height']),
    );
  }
}

class LibrarySong {
  const LibrarySong({
    required this.id,
    required this.title,
    required this.author,
    required this.key,
    required this.slideCount,
  });

  final String id;
  final String title;
  final String author;
  final String key;
  final int slideCount;

  factory LibrarySong.fromJson(Map<String, dynamic> json) {
    return LibrarySong(
      id: _str(json['id']),
      title: _str(json['title'], 'Untitled'),
      author: _str(json['author']),
      key: _str(json['key']),
      slideCount: _int(json['slideCount']),
    );
  }
}

// ---------------------------------------------------------------------------
// Tolerant JSON accessors
// ---------------------------------------------------------------------------

Map<String, dynamic> _map(Object? value) =>
    value is Map ? value.cast<String, dynamic>() : const {};

List<Map<String, dynamic>> _maps(Object? value) => value is List
    ? value.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList()
    : const [];

String _str(Object? value, [String fallback = '']) =>
    value is String ? value : fallback;

String? _nullableString(Object? value) =>
    value is String && value.isNotEmpty ? value : null;

int _int(Object? value, [int fallback = 0]) =>
    value is num ? value.toInt() : fallback;

bool _bool(Object? value, [bool fallback = false]) =>
    value is bool ? value : fallback;

List<String> _strings(Object? value) =>
    value is List ? value.whereType<String>().toList() : const [];
