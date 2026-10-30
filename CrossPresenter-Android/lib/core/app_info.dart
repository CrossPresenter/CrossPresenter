import 'package:package_info_plus/package_info_plus.dart';

/// Version metadata loaded once at startup. Keeping it in one place means the
/// footer, diagnostics, and update checker can never disagree about what is
/// installed.
abstract final class AppInfo {
  static String version = '1.0.0';
  static String buildNumber = '1';
  static String packageName = 'app.crosspresenter.remote';

  static String get label => 'v$version+$buildNumber';

  static Future<void> load() async {
    try {
      final info = await PackageInfo.fromPlatform();
      version = info.version;
      buildNumber = info.buildNumber;
      packageName = info.packageName;
    } on Exception {
      // A platform channel failure must not stop the app from opening.
    }
  }
}
