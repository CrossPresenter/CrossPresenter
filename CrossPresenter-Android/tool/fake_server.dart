// A tiny stand-in for the CrossPresenter desktop remote server.
//
// Useful for developing the Android client without building the Rust app.
// It speaks the v1 protocol: hello, state, ack, err, library, pong.
//
//   dart run tool/fake_server.dart
//
// Then pair with the printed crosspresenter:// link (token: dev-token) or
// enter host/port/token manually. On the Android emulator the host is
// 10.0.2.2; on a physical phone use the PC's LAN IP.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

const int port = 37645;
const String token = 'dev-token';

void main() async {
  final server = await HttpServer.bind(InternetAddress.anyIPv4, port);
  stdout.writeln('Fake CrossPresenter desktop listening on :$port');
  stdout.writeln('Token: $token');
  for (final address in await _lanAddresses()) {
    stdout.writeln(
      'Pair link: crosspresenter://pair?host=$address&port=$port'
      '&token=$token&name=Fake%20Desktop',
    );
  }
  stdout.writeln('Emulator host: 10.0.2.2 (port $port, token $token)');

  final desktop = _FakeDesktop();

  await for (final request in server) {
    if (request.uri.path != '/control' ||
        !WebSocketTransformer.isUpgradeRequest(request)) {
      request.response
        ..statusCode = HttpStatus.notFound
        ..write('CrossPresenter fake server');
      await request.response.close();
      continue;
    }
    if (request.uri.queryParameters['token'] != token) {
      request.response
        ..statusCode = HttpStatus.unauthorized
        ..write('Bad token');
      await request.response.close();
      continue;
    }

    final socket = await WebSocketTransformer.upgrade(request);
    final device = request.uri.queryParameters['name'] ?? 'Unknown phone';
    stdout.writeln(
      'Phone connected: $device (${request.uri.queryParameters['device']})',
    );
    desktop.attach(socket);
  }
}

Future<List<String>> _lanAddresses() async {
  final interfaces = await NetworkInterface.list(
    type: InternetAddressType.IPv4,
    includeLoopback: false,
  );
  return [
    for (final interface in interfaces)
      for (final address in interface.addresses)
        if (!address.isLoopback) address.address,
  ];
}

class _FakeDesktop {
  WebSocket? _socket;

  int rev = 1;
  int slideIndex = 0;
  String? liveItemId;
  bool blank = false;
  bool clearText = false;
  bool clearBackground = false;

  final List<_Item> items = [
    _Item('i1', 'Amazing Grace', 'song', 4),
    _Item('i2', 'How Great Thou Art', 'song', 3),
    _Item('i3', 'Welcome & Notices', 'text', 2),
  ];

  final List<_Song> songs = [
    _Song('s1', 'Amazing Grace', 'John Newton', 'G', 4),
    _Song('s2', 'How Great Thou Art', 'Carl Boberg', 'Bb', 3),
    _Song('s3', 'Tumhi Ho', 'Mithoon', 'Am', 5),
    _Song('s4', 'Namo Namo', 'Amit Trivedi', 'C', 4),
    _Song('s5', 'Way Maker', 'Sinach', 'D', 6),
    _Song('s6', 'Bande Utkala Janani', 'Laxmikanta Mohapatra', 'Eb', 3),
  ];

  final Map<String, List<List<String>>> lyrics = {
    'i1': [
      ['Amazing grace, how sweet the sound', 'That saved a wretch like me'],
      ['I once was lost, but now am found', 'Was blind, but now I see'],
      [
        '’Twas grace that taught my heart to fear',
        'And grace my fears relieved',
      ],
      ['How precious did that grace appear', 'The hour I first believed'],
    ],
    'i2': [
      [
        'O Lord my God, when I in awesome wonder',
        'Consider all the works Thy hands have made',
      ],
      [
        'I see the stars, I hear the rolling thunder',
        'Thy power throughout the universe displayed',
      ],
      [
        'Then sings my soul, my Saviour God, to Thee',
        'How great Thou art, how great Thou art',
      ],
    ],
    'i3': [
      ['Welcome to worship', 'Please silence your phones'],
      ['Notices', 'Youth night: Friday 7pm'],
    ],
  };

  void attach(WebSocket socket) {
    _socket = socket;
    send({
      'type': 'hello',
      'protocol': 1,
      'appVersion': '1.0.0-fake',
      'serverName': 'Fake Desktop',
      'capabilities': ['slide', 'library', 'audio', 'overlay'],
    });
    sendState();

    socket.listen(
      (raw) {
        final frame = jsonDecode(raw as String) as Map<String, dynamic>;
        switch (frame['type']) {
          case 'ping':
            send({'type': 'pong', 't': frame['t'], 'serverT': _now});
          case 'cmd':
            _command(frame);
        }
      },
      onDone: () {
        stdout.writeln('Phone disconnected');
        _socket = null;
      },
    );
  }

  void _command(Map<String, dynamic> frame) {
    final id = frame['id'] as String? ?? '';
    final seq = frame['seq'] as int? ?? 0;
    final action = frame['action'] as String? ?? '';
    final args = (frame['args'] as Map?)?.cast<String, dynamic>() ?? const {};
    stdout.writeln('cmd $action $args');

    switch (action) {
      case 'slide.next':
        final total = _slideCount;
        if (total > 0 && slideIndex < total - 1) slideIndex++;
      case 'slide.prev':
        if (slideIndex > 0) slideIndex--;
      case 'item.project':
        final itemId = args['itemId'] as String?;
        final item = items.where((item) => item.id == itemId).firstOrNull;
        if (item != null) {
          liveItemId = item.id;
          slideIndex = 0;
          blank = false;
          clearText = false;
          clearBackground = false;
        }
      case 'live.black':
        blank = !blank;
      case 'live.clearText':
        clearText = !clearText;
      case 'live.clearBackground':
        clearBackground = !clearBackground;
      case 'live.stop':
        liveItemId = null;
        slideIndex = 0;
        blank = false;
        clearText = false;
        clearBackground = false;
      case 'library.search':
        final query = (args['query'] as String? ?? '').toLowerCase().trim();
        final results = query.isEmpty
            ? songs
            : songs
                  .where(
                    (song) =>
                        song.title.toLowerCase().contains(query) ||
                        song.author.toLowerCase().contains(query),
                  )
                  .toList();
        send({
          'type': 'library',
          'queryId': args['queryId'] ?? 'q-$id',
          'songs': [for (final song in results) song.toJson()],
        });
      default:
        send({
          'type': 'err',
          'id': id,
          'code': 'unknown_action',
          'message': 'Unknown action: $action',
        });
    }

    rev++;
    send({'type': 'ack', 'id': id, 'seq': seq, 'rev': rev, 'serverT': _now});
    sendState();
  }

  int get _slideCount =>
      liveItemId == null ? 0 : (lyrics[liveItemId]?.length ?? 0);

  List<String> get _lines {
    final itemId = liveItemId;
    if (itemId == null) return const [];
    final slides = lyrics[itemId] ?? const [];
    if (slideIndex >= slides.length) return const [];
    return slides[slideIndex];
  }

  void sendState() {
    final item = items.where((item) => item.id == liveItemId).firstOrNull;
    send({
      'type': 'state',
      'rev': rev,
      'show': {
        'title': 'Sunday Morning',
        'items': [for (final item in items) item.toJson()],
      },
      'live': {
        'active': liveItemId != null,
        'itemId': liveItemId,
        'slideId': _slideCount == 0 ? null : 'slide-${slideIndex + 1}',
        'itemTitle': item?.title,
        'slideIndex': slideIndex,
        'slideCount': _slideCount,
        'blank': blank,
        'clearText': clearText,
        'clearBackground': clearBackground,
      },
      'slide': _slideCount == 0
          ? null
          : {
              'id': 'slide-${slideIndex + 1}',
              'label': 'Slide ${slideIndex + 1}',
              'lines': _lines,
              'nextLabel': slideIndex + 1 < _slideCount
                  ? 'Slide ${slideIndex + 2}'
                  : null,
            },
      'audio': {'playing': false, 'title': null, 'loop': false},
      'overlays': const [],
      'monitors': const [
        {'id': 'm1', 'name': 'Display 1', 'width': 1920, 'height': 1080},
      ],
    });
  }

  void send(Map<String, dynamic> message) {
    _socket?.add(jsonEncode(message));
  }

  int get _now => DateTime.now().millisecondsSinceEpoch;
}

class _Item {
  const _Item(this.id, this.title, this.kind, this.slideCount);
  final String id;
  final String title;
  final String kind;
  final int slideCount;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'kind': kind,
    'slideCount': slideCount,
  };
}

class _Song {
  const _Song(this.id, this.title, this.author, this.key, this.slideCount);
  final String id;
  final String title;
  final String author;
  final String key;
  final int slideCount;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'author': author,
    'key': key,
    'slideCount': slideCount,
  };
}
