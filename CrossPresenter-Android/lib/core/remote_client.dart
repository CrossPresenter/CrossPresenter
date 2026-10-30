/// One WebSocket connection to the desktop, with reconnect and latency stats.
///
/// The client is deliberately a plain [ChangeNotifier]: the UI wraps it in an
/// `AnimatedBuilder`, so a state broadcast only rebuilds the widgets that read
/// it. Commands are fire-and-forget with an id/seq for acknowledgement; the
/// server's state snapshot is always authoritative.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'protocol.dart';

enum RemotePhase { idle, connecting, connected, reconnecting, failed }

class RemoteClient extends ChangeNotifier {
  RemoteClient({this.pingInterval = const Duration(seconds: 5)});

  final Duration pingInterval;

  RemotePhase phase = RemotePhase.idle;
  String? error;
  String? lastCommandError;

  HelloMessage? hello;
  RemoteState state = RemoteState.empty;
  List<LibrarySong> songs = const [];
  String? libraryQueryId;
  Uint8List? previewJpeg;

  int? rttMs;
  int? rttBestMs;
  int? rttWorstMs;
  double _rttSum = 0;
  int _rttCount = 0;

  DateTime? connectedAt;
  PairTarget? target;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _pingTimer;
  Timer? _reconnectTimer;
  DateTime _lastPong = DateTime.now();
  bool _userClosed = false;
  bool _fatal = false;
  int _attempt = 0;
  int _seq = 0;
  final Random _random = Random();

  bool get isConnected => phase == RemotePhase.connected;
  bool get isBusy =>
      phase == RemotePhase.connecting || phase == RemotePhase.reconnecting;

  /// Connect, or reconnect to the last target. Safe to call repeatedly.
  Future<void> connect(
    PairTarget nextTarget, {
    required String deviceId,
    required String deviceName,
  }) async {
    _userClosed = false;
    _fatal = false;
    _attempt = 0;
    target = nextTarget;
    _deviceId = deviceId;
    _deviceName = deviceName;
    _resetSession();
    await _open();
  }

  String _deviceId = '';
  String _deviceName = 'CrossPresenter Remote';

  Future<void> _open() async {
    final target = this.target;
    if (target == null || _userClosed || _fatal) return;

    _cancelReconnect();
    _closeChannel();
    phase = _attempt == 0 ? RemotePhase.connecting : RemotePhase.reconnecting;
    error = null;
    notifyListeners();

    final channel = WebSocketChannel.connect(
      target.controlUri(deviceId: _deviceId, deviceName: _deviceName),
    );
    _channel = channel;
    _subscription = channel.stream.listen(
      (data) => _onFrame(channel, data),
      onDone: () => _onClosed(channel),
      onError: (Object _) => _fail(channel, 'Connection lost'),
      cancelOnError: true,
    );

    try {
      await channel.ready;
      if (_channel != channel) return;
      phase = RemotePhase.connected;
      error = null;
      _attempt = 0;
      _lastPong = DateTime.now();
      connectedAt = DateTime.now();
      _startPing();
      _sendPing(); // populate the RTT readout immediately
      notifyListeners();
    } catch (_) {
      if (_channel != channel) return;
      _fail(channel, 'Could not reach ${target.host}:${target.port}');
    }
  }

  void _onFrame(WebSocketChannel channel, Object? data) {
    if (_channel != channel) return;

    final text = switch (data) {
      String value => value,
      List<int> bytes => utf8.decode(bytes),
      _ => null,
    };
    if (text == null) return;

    Object? decoded;
    try {
      decoded = jsonDecode(text);
    } on FormatException {
      return; // A malformed frame is not worth tearing down a working link.
    }

    final message = parseServerMessage(decoded);
    switch (message) {
      case null:
        return;
      case HelloMessage hello:
        this.hello = hello;
        if (hello.protocol != protocolVersion) {
          _fatal = true;
          error =
              'The desktop speaks protocol v${hello.protocol}; this app '
              'speaks v$protocolVersion. Update the app or the desktop.';
          unawaited(channel.sink.close(4002, 'protocol mismatch'));
          phase = RemotePhase.failed;
          notifyListeners();
          return;
        }
        notifyListeners();
      case StateMessage(:final state):
        // Revisions are monotonic; an old snapshot must never overwrite a newer
        // one after a reconnect race.
        if (state.rev >= this.state.rev) {
          this.state = state;
          notifyListeners();
        }
      case AckMessage():
        // Acknowledgements are intentionally quiet: the state broadcast is the
        // thing the UI renders, and a snackbar per tap would be noise.
        break;
      case CommandErrorMessage(:final message):
        lastCommandError = message;
        notifyListeners();
      case LibraryMessage(:final queryId, :final songs):
        libraryQueryId = queryId;
        this.songs = songs;
        notifyListeners();
      case PongMessage(:final clientTime):
        _recordRtt(DateTime.now().millisecondsSinceEpoch - clientTime);
        _lastPong = DateTime.now();
      case PreviewMessage(:final data):
        try {
          previewJpeg = base64Decode(data);
        } on FormatException {
          // Ignore a corrupt preview; the text view still works.
        }
        notifyListeners();
    }
  }

  void _onClosed(WebSocketChannel channel) {
    if (_channel != channel) return;
    final code = channel.closeCode;
    switch (code) {
      case 4001:
        _fail(
          channel,
          'This phone is not paired with that desktop.',
          fatal: true,
        );
      case 4002:
        _fail(
          channel,
          'The app and desktop versions do not match.',
          fatal: true,
        );
      case 4003:
        _fail(
          channel,
          'Too many commands. Wait a moment and reconnect.',
          fatal: true,
        );
      default:
        _fail(channel, 'Connection lost');
    }
  }

  void _fail(WebSocketChannel channel, String message, {bool fatal = false}) {
    if (_channel != channel) return;
    _closeChannel();
    _stopPing();
    error = message;

    if (_userClosed) {
      phase = RemotePhase.idle;
      notifyListeners();
      return;
    }
    if (fatal) {
      _fatal = true;
      phase = RemotePhase.failed;
      notifyListeners();
      return;
    }

    phase = RemotePhase.reconnecting;
    _scheduleReconnect();
    notifyListeners();
  }

  void _scheduleReconnect() {
    _cancelReconnect();
    _attempt++;
    final delay = switch (_attempt) {
      1 => const Duration(milliseconds: 500),
      2 => const Duration(seconds: 1),
      3 => const Duration(seconds: 2),
      _ => const Duration(seconds: 5),
    };
    _reconnectTimer = Timer(delay, () {
      if (!_userClosed && !_fatal) unawaited(_open());
    });
  }

  void _startPing() {
    _stopPing();
    _pingTimer = Timer.periodic(pingInterval, (_) {
      if (phase != RemotePhase.connected) return;
      if (DateTime.now().difference(_lastPong) >
          Duration(seconds: pingInterval.inSeconds * 3)) {
        final channel = _channel;
        if (channel != null) _fail(channel, 'Connection timed out');
        return;
      }
      _sendPing();
    });
  }

  void _stopPing() {
    _pingTimer?.cancel();
    _pingTimer = null;
  }

  void _sendPing() {
    _channel?.sink.add(
      encodePing(clientTime: DateTime.now().millisecondsSinceEpoch),
    );
  }

  void _recordRtt(int value) {
    if (value < 0) return;
    rttMs = value;
    rttBestMs = rttBestMs == null ? value : min(rttBestMs!, value);
    rttWorstMs = rttWorstMs == null ? value : max(rttWorstMs!, value);
    _rttSum += value;
    _rttCount++;
    notifyListeners();
  }

  double? get rttAverageMs => _rttCount == 0 ? null : _rttSum / _rttCount;

  /// Send a command. Returns false when there is no live connection, so the
  /// caller can show "not connected" instead of silently losing the tap.
  bool send(String action, [Map<String, dynamic> args = const {}]) {
    final channel = _channel;
    if (channel == null || phase != RemotePhase.connected) return false;
    _seq++;
    final id = 'c-$_seq-${_random.nextInt(0x7fffffff).toRadixString(16)}';
    channel.sink.add(
      encodeCommand(id: id, seq: _seq, action: action, args: args),
    );
    return true;
  }

  bool nextSlide() => send(RemoteActions.slideNext);
  bool previousSlide() => send(RemoteActions.slidePrev);
  bool projectItem(String itemId) =>
      send(RemoteActions.itemProject, {'itemId': itemId});
  bool goToSlide({required String itemId, required String slideId}) =>
      send(RemoteActions.slideGoto, {'itemId': itemId, 'slideId': slideId});
  bool toggleBlack() => send(RemoteActions.liveBlack);
  bool toggleClearText() => send(RemoteActions.liveClearText);
  bool toggleClearBackground() => send(RemoteActions.liveClearBackground);
  bool stopLive() => send(RemoteActions.liveStop);
  bool stopAudio() => send(RemoteActions.audioStop);
  bool searchSongs(String query) =>
      send(RemoteActions.librarySearch, {'query': query, 'limit': 50});

  Future<void> disconnect() async {
    _userClosed = true;
    _fatal = false;
    _cancelReconnect();
    _stopPing();
    final channel = _channel;
    _closeChannel();
    if (channel != null) {
      await channel.sink.close(1000, 'user disconnected');
    }
    phase = RemotePhase.idle;
    error = null;
    notifyListeners();
  }

  void _closeChannel() {
    _subscription?.cancel();
    _subscription = null;
    _channel = null;
  }

  void _cancelReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  void _resetSession() {
    hello = null;
    state = RemoteState.empty;
    songs = const [];
    libraryQueryId = null;
    previewJpeg = null;
    error = null;
    lastCommandError = null;
    rttMs = null;
    rttBestMs = null;
    rttWorstMs = null;
    _rttSum = 0;
    _rttCount = 0;
    connectedAt = null;
  }

  @override
  void dispose() {
    _userClosed = true;
    _cancelReconnect();
    _stopPing();
    _closeChannel();
    super.dispose();
  }
}
