import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_info.dart';

/// The GitHub repository that publishes both desktop and Android builds.
const String releaseRepository = 'CrossPresenter/CrossPresenter';

/// Android releases are tagged `mobile-vX.Y.Z`; desktop releases use their own
/// scheme. Filtering keeps the two update channels from seeing each other.
const String mobileTagPrefix = 'mobile-v';

enum UpdatePhase {
  idle,
  checking,
  upToDate,
  available,
  downloading,
  ready,
  error,
}

class MobileRelease {
  const MobileRelease({
    required this.tag,
    required this.version,
    required this.title,
    required this.notes,
    required this.publishedAt,
    required this.apkUrl,
    required this.apkSize,
    required this.sha256Url,
    required this.htmlUrl,
  });

  final String tag;
  final String version;
  final String title;
  final String notes;
  final DateTime publishedAt;
  final String? apkUrl;
  final int apkSize;
  final String? sha256Url;
  final String htmlUrl;

  static MobileRelease? fromGitHub(Map<String, dynamic> json) {
    final tag = json['tag_name'] as String? ?? '';
    if (!tag.startsWith(mobileTagPrefix)) return null;
    if (json['draft'] == true || json['prerelease'] == true) return null;

    final version = tag.substring(mobileTagPrefix.length).trim();
    if (version.isEmpty) return null;

    final assets = (json['assets'] as List? ?? const [])
        .whereType<Map>()
        .map((asset) => asset.cast<String, dynamic>())
        .toList();
    Map<String, dynamic>? apk;
    for (final asset in assets) {
      final name = (asset['name'] as String? ?? '').toLowerCase();
      if (name.endsWith('.apk')) {
        apk = asset;
        break;
      }
    }
    if (apk == null) return null;

    final apkName = apk['name'] as String? ?? '';
    Map<String, dynamic>? checksum;
    for (final asset in assets) {
      final name = asset['name'] as String? ?? '';
      if (name == '$apkName.sha256' ||
          name.toLowerCase().endsWith('.apk.sha256')) {
        checksum = asset;
        break;
      }
    }

    return MobileRelease(
      tag: tag,
      version: version,
      title: (json['name'] as String?)?.trim().isNotEmpty == true
          ? json['name'] as String
          : 'CrossPresenter Remote v$version',
      notes: (json['body'] as String? ?? '').trim(),
      publishedAt:
          DateTime.tryParse(
            json['published_at'] as String? ??
                json['created_at'] as String? ??
                '',
          )?.toLocal() ??
          DateTime.now(),
      apkUrl: apk['browser_download_url'] as String?,
      apkSize: (apk['size'] as num?)?.toInt() ?? 0,
      sha256Url: checksum?['browser_download_url'] as String?,
      htmlUrl: json['html_url'] as String? ?? '',
    );
  }
}

/// Checks GitHub Releases, downloads an APK with progress, verifies its
/// checksum when the release publishes one, and hands it to Android's installer.
///
/// This intentionally does not use the Play Store: the desktop app is installed
/// directly from GitHub, and the remote is distributed the same way.
class UpdateService extends ChangeNotifier {
  UpdateService({http.Client? client}) : _client = client ?? http.Client();

  static const _apiUrl =
      'https://api.github.com/repos/$releaseRepository/releases?per_page=50';
  static const _cacheKey = 'cp.remote.releasesCache';

  final http.Client _client;

  UpdatePhase phase = UpdatePhase.idle;
  String? error;
  List<MobileRelease> releases = const [];
  double? progress;
  String? downloadingTag;
  String? downloadedPath;
  String? downloadedVersion;
  DateTime? lastCheckedAt;
  bool lastCheckUserInitiated = false;

  bool _initialized = false;
  bool _disposed = false;

  MobileRelease? get latest => releases.isEmpty ? null : releases.first;

  bool get updateAvailable {
    final release = latest;
    if (release == null) return false;
    return _compareVersions(release.version, AppInfo.version) > 0;
  }

  bool get isChecking => phase == UpdatePhase.checking;
  bool get isDownloading => phase == UpdatePhase.downloading;

  /// Load the last successful release list so version history and the settings
  /// page still work on a LAN with no internet.
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString(_cacheKey);
      if (cached != null) {
        final parsed = _parseReleases(cached);
        if (parsed.isNotEmpty) {
          releases = parsed;
          _notify();
        }
      }
    } on Exception {
      // Cache is a convenience only.
    }
  }

  Future<void> check({bool userInitiated = false}) async {
    if (phase == UpdatePhase.checking || phase == UpdatePhase.downloading) {
      return;
    }
    lastCheckUserInitiated = userInitiated;
    phase = UpdatePhase.checking;
    error = null;
    _notify();

    try {
      final response = await _client
          .get(
            Uri.parse(_apiUrl),
            headers: const {
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'CrossPresenter-Remote',
            },
          )
          .timeout(const Duration(seconds: 20));

      if (response.statusCode == 403 || response.statusCode == 429) {
        phase = UpdatePhase.error;
        error =
            'GitHub is rate-limiting update checks. Try again in a few minutes.';
        _notify();
        return;
      }
      if (response.statusCode != 200) {
        phase = UpdatePhase.error;
        error = 'GitHub returned HTTP ${response.statusCode}.';
        _notify();
        return;
      }

      final body = utf8.decode(response.bodyBytes);
      final parsed = _parseReleases(body);
      if (parsed.isNotEmpty) {
        releases = parsed;
        await _cache(body);
      }
      lastCheckedAt = DateTime.now();
      phase = updateAvailable ? UpdatePhase.available : UpdatePhase.upToDate;
      _notify();
    } on TimeoutException {
      phase = UpdatePhase.error;
      error = 'The update check timed out.';
      _notify();
    } on SocketException {
      phase = UpdatePhase.error;
      error = 'No connection to GitHub. Update checks need internet.';
      _notify();
    } on Exception catch (exception) {
      phase = UpdatePhase.error;
      error = 'Could not check for updates: $exception';
      _notify();
    }
  }

  /// Download and (by default) launch the system installer.
  ///
  /// Returns true when the installer was handed the APK. Android may still ask
  /// the user to allow installs from this app the first time.
  Future<bool> downloadAndInstall(
    MobileRelease release, {
    bool install = true,
  }) async {
    if (phase == UpdatePhase.downloading) return false;
    final url = release.apkUrl;
    if (url == null || url.isEmpty) {
      phase = UpdatePhase.error;
      error = 'This release does not have an APK attached.';
      _notify();
      return false;
    }

    phase = UpdatePhase.downloading;
    downloadingTag = release.tag;
    progress = 0;
    error = null;
    _notify();

    File? target;
    try {
      final cache = await getTemporaryDirectory();
      final directory = Directory('${cache.path}/cp-updates');
      await directory.create(recursive: true);
      target = File('${directory.path}/${_safeFileName(release)}');

      final request = http.Request('GET', Uri.parse(url))
        ..headers['User-Agent'] = 'CrossPresenter-Remote';
      final response = await _client
          .send(request)
          .timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        throw StateError('Download returned HTTP ${response.statusCode}.');
      }

      final expectedBytes = response.contentLength ?? release.apkSize;
      final sink = target.openWrite();
      var received = 0;
      try {
        await for (final chunk in response.stream) {
          sink.add(chunk);
          received += chunk.length;
          if (!_disposed) {
            progress = expectedBytes > 0 ? received / expectedBytes : null;
            _notify();
          }
        }
      } finally {
        await sink.flush();
        await sink.close();
      }

      if (expectedBytes > 0 && received != expectedBytes) {
        throw StateError(
          'The download stopped early ($received of $expectedBytes bytes).',
        );
      }

      final checksumUrl = release.sha256Url;
      if (checksumUrl != null && checksumUrl.isNotEmpty) {
        await _verifyChecksum(target, checksumUrl);
      }

      downloadedPath = target.path;
      downloadedVersion = release.version;
      progress = 1;
      phase = UpdatePhase.ready;
      _notify();

      if (install) {
        return await installDownloaded();
      }
      return true;
    } on Exception catch (exception) {
      phase = UpdatePhase.error;
      error = 'Update download failed: $exception';
      _notify();
      if (target != null && await target.exists()) {
        try {
          await target.delete();
        } on Exception {
          // A leftover partial APK is harmless and will be overwritten.
        }
      }
      return false;
    }
  }

  Future<bool> installDownloaded() async {
    final path = downloadedPath;
    if (path == null || path.isEmpty) {
      phase = UpdatePhase.error;
      error = 'No downloaded APK to install.';
      _notify();
      return false;
    }
    final result = await OpenFilex.open(
      path,
      type: 'application/vnd.android.package-archive',
    );
    if (result.type != ResultType.done) {
      phase = UpdatePhase.error;
      error = 'Could not open the installer: ${result.message}';
      _notify();
      return false;
    }
    return true;
  }

  void clearError() {
    if (phase == UpdatePhase.error) {
      phase = UpdatePhase.idle;
    }
    error = null;
    _notify();
  }

  Future<void> _verifyChecksum(File file, String checksumUrl) async {
    final response = await _client
        .get(Uri.parse(checksumUrl))
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) return; // Checksum is optional, not fatal.
    final text = utf8.decode(response.bodyBytes).trim();
    if (text.isEmpty) return;
    final expected = text.split(RegExp(r'\s+')).first.toLowerCase();
    final digest = await sha256.bind(file.openRead()).first;
    if (digest.toString().toLowerCase() != expected) {
      throw StateError('Checksum mismatch. The download was corrupted.');
    }
  }

  List<MobileRelease> _parseReleases(String body) {
    final decoded = jsonDecode(body);
    if (decoded is! List) return const [];
    final parsed = <MobileRelease>[];
    for (final item in decoded) {
      if (item is! Map) continue;
      final release = MobileRelease.fromGitHub(item.cast<String, dynamic>());
      if (release != null) parsed.add(release);
    }
    parsed.sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    return parsed;
  }

  Future<void> _cache(String body) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, body);
    } on Exception {
      // Nothing depends on the cache.
    }
  }

  int _compareVersions(String candidate, String current) {
    final left = _parseVersion(candidate);
    final right = _parseVersion(current);
    for (var index = 0; index < 3; index++) {
      final difference = left.$1[index].compareTo(right.$1[index]);
      if (difference != 0) return difference;
    }
    // A rebuild of the same semantic version is still an update when both
    // sides publish a build number (e.g. 1.0.1+3 over 1.0.1+2).
    if (left.$2 != null && right.$2 != null) {
      return left.$2!.compareTo(right.$2!);
    }
    return 0;
  }

  (List<int>, int?) _parseVersion(String raw) {
    var value = raw.trim();
    if (value.startsWith('v')) value = value.substring(1);
    int? build;
    final plus = value.indexOf('+');
    if (plus >= 0) {
      build = int.tryParse(value.substring(plus + 1));
      value = value.substring(0, plus);
    }
    value = value.split('-').first;
    final parts = <int>[];
    for (final part in value.split('.')) {
      parts.add(int.tryParse(part) ?? 0);
    }
    while (parts.length < 3) {
      parts.add(0);
    }
    return (parts, build);
  }

  String _safeFileName(MobileRelease release) {
    final version = release.version.replaceAll(RegExp(r'[^0-9A-Za-z._-]'), '_');
    return 'CrossPresenter-Remote-$version.apk';
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _client.close();
    super.dispose();
  }
}
