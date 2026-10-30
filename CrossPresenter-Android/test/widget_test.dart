import 'dart:convert';

import 'package:crosspresenter_remote/core/protocol.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PairTarget', () {
    test('parses a full pairing URI', () {
      final target = PairTarget.fromPairingUri(
        'crosspresenter://pair?host=192.168.1.42&port=37645&token=abc123&name=Front%20Laptop',
      );
      expect(target, isNotNull);
      expect(target!.host, '192.168.1.42');
      expect(target.port, 37645);
      expect(target.token, 'abc123');
      expect(target.name, 'Front Laptop');
    });

    test('defaults the port', () {
      final target = PairTarget.fromPairingUri(
        'crosspresenter://pair?host=10.0.0.5&token=t',
      );
      expect(target!.port, defaultRemotePort);
    });

    test('rejects unrelated QR codes', () {
      expect(PairTarget.fromPairingUri('https://example.com'), isNull);
      expect(PairTarget.fromPairingUri('crosspresenter://pair?host=x'), isNull);
      expect(PairTarget.fromPairingUri('not a uri'), isNull);
    });

    test('builds the control WebSocket URL', () {
      const target = PairTarget(host: '10.0.0.5', port: 40000, token: 'secret');
      final uri = target.controlUri(deviceId: 'phone-1', deviceName: 'Pixel');
      expect(uri.scheme, 'ws');
      expect(uri.host, '10.0.0.5');
      expect(uri.port, 40000);
      expect(uri.path, '/control');
      expect(uri.queryParameters['token'], 'secret');
      expect(uri.queryParameters['device'], 'phone-1');
    });
  });

  group('server messages', () {
    test('parses hello', () {
      final message = parseServerMessage({
        'type': 'hello',
        'protocol': 1,
        'appVersion': '1.0.0',
        'serverName': 'Laptop',
        'capabilities': ['slide', 'library'],
      });
      expect(message, isA<HelloMessage>());
      expect((message as HelloMessage).serverName, 'Laptop');
      expect(message.capabilities, contains('library'));
    });

    test('parses a state snapshot and tolerates missing fields', () {
      final message = parseServerMessage({
        'type': 'state',
        'rev': 12,
        'show': {
          'title': 'Sunday',
          'items': [
            {
              'id': 'i1',
              'title': 'Amazing Grace',
              'kind': 'song',
              'slideCount': 4,
            },
          ],
        },
        'live': {
          'active': true,
          'itemId': 'i1',
          'slideId': 's2',
          'itemTitle': 'Amazing Grace',
          'slideIndex': 1,
          'slideCount': 4,
          'blank': false,
        },
        'slide': {
          'id': 's2',
          'label': 'Verse 1',
          'lines': ['Amazing grace', 'how sweet the sound'],
          'nextLabel': 'Verse 2',
        },
        'audio': {'playing': false},
      });
      expect(message, isA<StateMessage>());
      final state = (message as StateMessage).state;
      expect(state.rev, 12);
      expect(state.show.items, hasLength(1));
      expect(state.live.itemTitle, 'Amazing Grace');
      expect(state.slide!.lines, hasLength(2));
      expect(state.slide!.nextLine, 'Verse 2');
      expect(state.monitors, isEmpty);
    });

    test('ignores unknown message types', () {
      expect(parseServerMessage({'type': 'future-thing'}), isNull);
      expect(parseServerMessage('nope'), isNull);
    });
  });

  test('encodes a command frame', () {
    final text = encodeCommand(
      id: 'c-1',
      seq: 1,
      action: RemoteActions.slideNext,
    );
    final json = jsonDecode(text) as Map<String, dynamic>;
    expect(json['type'], 'cmd');
    expect(json['action'], 'slide.next');
    expect(json['seq'], 1);
    expect(json['args'], isEmpty);
  });
}
