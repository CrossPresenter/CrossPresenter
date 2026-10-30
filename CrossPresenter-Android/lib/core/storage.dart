/// Persistent pairing data.
///
/// The token is a bearer credential: it lives in [FlutterSecureStorage]
/// (Android Keystore-backed), while the harmless host/port/name live in plain
/// preferences so the connect screen can render instantly.
library;

import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'protocol.dart';

class TargetStore {
  TargetStore({FlutterSecureStorage? secure})
    : _secure = secure ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secure;

  static const _hostKey = 'cp.remote.host';
  static const _portKey = 'cp.remote.port';
  static const _nameKey = 'cp.remote.name';
  static const _tokenKey = 'cp.remote.token';
  static const _deviceIdKey = 'cp.remote.deviceId';
  static const _deviceNameKey = 'cp.remote.deviceName';

  Future<PairTarget?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final host = prefs.getString(_hostKey);
    if (host == null || host.isEmpty) return null;
    String? token;
    try {
      token = await _secure.read(key: _tokenKey);
    } on Exception {
      return null;
    }
    if (token == null || token.isEmpty) return null;
    return PairTarget(
      host: host,
      port: prefs.getInt(_portKey) ?? defaultRemotePort,
      token: token,
      name: prefs.getString(_nameKey),
    );
  }

  Future<void> save(PairTarget target) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_hostKey, target.host);
    await prefs.setInt(_portKey, target.port);
    if (target.name != null) {
      await prefs.setString(_nameKey, target.name!);
    } else {
      await prefs.remove(_nameKey);
    }
    await _secure.write(key: _tokenKey, value: target.token);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_hostKey);
    await prefs.remove(_portKey);
    await prefs.remove(_nameKey);
    try {
      await _secure.delete(key: _tokenKey);
    } on Exception {
      // A missing key is already forgotten.
    }
  }

  /// Stable ID for this installation, generated once. The desktop uses it to
  /// remember the paired device independently of its IP address.
  Future<String> deviceId() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final random = Random.secure();
    final id = List.generate(
      16,
      (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
    await prefs.setString(_deviceIdKey, id);
    return id;
  }

  Future<String> deviceName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_deviceNameKey) ?? 'Android phone';
  }

  Future<void> setDeviceName(String name) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_deviceNameKey, name.trim());
  }
}
