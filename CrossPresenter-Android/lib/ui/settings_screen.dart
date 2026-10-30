import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_info.dart';
import '../core/protocol.dart';
import '../core/remote_client.dart';
import '../core/storage.dart';
import '../core/update_service.dart';
import '../state/providers.dart';
import 'theme.dart';
import 'update_dialog.dart';

/// App settings, update history, device specs, and desktop pairing controls.
///
/// Reachable both from the paired remote and from the pairing screen, so an
/// update can be installed before a desktop is available.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key, required this.client});

  final RemoteClient client;

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  AndroidDeviceInfo? _device;
  bool _loadingDevice = true;

  UpdateService get _updates => ref.read(updateServiceProvider);
  TargetStore get _store => ref.read(targetStoreProvider);

  @override
  void initState() {
    super.initState();
    _loadDevice();
    // Safe to call again: the service ignores repeat initialization.
    _updates.init();
  }

  Future<void> _loadDevice() async {
    try {
      final info = await DeviceInfoPlugin().androidInfo;
      if (!mounted) return;
      setState(() {
        _device = info;
        _loadingDevice = false;
      });
    } on Exception {
      if (!mounted) return;
      setState(() => _loadingDevice = false);
    }
  }

  Future<void> _checkForUpdates() async {
    final service = _updates;
    await service.check(userInitiated: true);
    if (!mounted) return;
    switch (service.phase) {
      case UpdatePhase.available:
        await showUpdatePrompt(context, service);
      case UpdatePhase.upToDate:
        _snack('You are on the latest version (${AppInfo.label}).');
      case UpdatePhase.error:
        _snack(service.error ?? 'Could not check for updates.');
      default:
        break;
    }
  }

  Future<void> _download(MobileRelease release) async {
    final service = _updates;
    final latest = service.latest;
    if (latest != null && release.tag != latest.tag) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: CpColors.surfaceHigh,
          title: const Text('Install an older version?'),
          content: Text(
            'Android usually refuses to install an older APK over a newer one. '
            'You can download v${release.version} now; if the installer blocks '
            'it, uninstall CrossPresenter Remote first (that forgets the paired '
            'desktop), then install this APK.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Download'),
            ),
          ],
        ),
      );
      if (proceed != true || !mounted) return;
    }
    await service.downloadAndInstall(release);
  }

  Future<void> _openReleasePage(MobileRelease release) async {
    final uri = Uri.tryParse(release.htmlUrl);
    if (uri == null) return;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) _snack('Could not open GitHub.');
  }

  Future<void> _forgetDesktop() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: CpColors.surfaceHigh,
        title: const Text('Forget this desktop?'),
        content: const Text(
          'The pairing token is deleted from this phone. Scan the desktop QR '
          'again to reconnect.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: CpColors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Forget'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _store.clear();
    await widget.client.disconnect();
    if (!mounted) return;
    _snack('Pairing forgotten.');
  }

  void _snack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final client = widget.client;
    final updates = ref.watch(updateServiceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: AnimatedBuilder(
        animation: Listenable.merge([client, updates]),
        builder: (context, _) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 36),
            children: [
              _SectionTitle('APP & UPDATES'),
              CpCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [CpColors.accent, Color(0xFF4F8CFF)],
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.cast_connected,
                            color: Colors.white,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'CrossPresenter Remote',
                                style: TextStyle(
                                  color: CpColors.text,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Installed ${AppInfo.label} · protocol v$protocolVersion',
                                style: const TextStyle(
                                  color: CpColors.textMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (updates.updateAvailable) ...[
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(11),
                        decoration: BoxDecoration(
                          color: CpColors.accentSoft,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: CpColors.accent.withValues(alpha: 0.45),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.system_update,
                              color: CpColors.accent,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'v${updates.latest!.version} is available',
                                style: const TextStyle(
                                  color: CpColors.accent,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (updates.phase == UpdatePhase.downloading) ...[
                      const SizedBox(height: 14),
                      LinearProgressIndicator(
                        value: updates.progress,
                        backgroundColor: CpColors.surface,
                        minHeight: 5,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ],
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        OutlinedButton.icon(
                          onPressed: updates.isChecking || updates.isDownloading
                              ? null
                              : _checkForUpdates,
                          icon: updates.isChecking
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.refresh, size: 18),
                          label: Text(
                            updates.isChecking
                                ? 'Checking…'
                                : 'Check for updates',
                          ),
                        ),
                        if (updates.updateAvailable)
                          FilledButton.icon(
                            onPressed: updates.isDownloading
                                ? null
                                : () => showUpdatePrompt(context, updates),
                            icon: const Icon(Icons.system_update, size: 18),
                            label: Text(
                              'Update to v${updates.latest!.version}',
                            ),
                          ),
                      ],
                    ),
                    if (updates.lastCheckedAt != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        'Last checked ${_formatDateTime(updates.lastCheckedAt!)}',
                        style: const TextStyle(
                          color: CpColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  const _SectionTitle('VERSION HISTORY'),
                  const Spacer(),
                  if (updates.releases.isNotEmpty)
                    Text(
                      '${updates.releases.length} releases',
                      style: const TextStyle(
                        color: CpColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                ],
              ),
              if (updates.releases.isEmpty)
                CpCard(
                  child: Text(
                    'No published Android releases yet. Run the Android GitHub '
                    'Actions workflow (or tag mobile-vX.Y.Z) and the first build '
                    'will appear here with its size and release notes.',
                    style: TextStyle(
                      color: CpColors.textMuted,
                      fontSize: 12.5,
                      height: 1.5,
                    ),
                  ),
                )
              else
                ...updates.releases.map(
                  (release) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReleaseCard(
                      release: release,
                      updates: updates,
                      onDownload: () => _download(release),
                      onOpenPage: () => _openReleasePage(release),
                    ),
                  ),
                ),
              const SizedBox(height: 6),
              const Text(
                'Android only installs the same or a newer version. Older APKs '
                'are kept for reference; installing one may require uninstalling '
                'the current app and pairing again.',
                style: TextStyle(
                  color: CpColors.textMuted,
                  fontSize: 11,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 22),
              _SectionTitle('THIS DEVICE'),
              CpCard(
                child: Column(
                  children: [
                    _InfoRow('App version', AppInfo.label),
                    _InfoRow('Package', AppInfo.packageName),
                    _InfoRow(
                      'Android',
                      _device == null
                          ? (_loadingDevice ? 'Loading…' : 'Unknown')
                          : '${_device!.version.release} (SDK ${_device!.version.sdkInt})',
                    ),
                    _InfoRow(
                      'Device',
                      _device == null
                          ? '—'
                          : '${_device!.manufacturer} ${_device!.model}',
                    ),
                    _InfoRow(
                      'CPU',
                      _device == null ? '—' : _device!.supportedAbis.join(', '),
                    ),
                    const _InfoRow('Update channel', 'GitHub Releases'),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              _SectionTitle('DESKTOP CONNECTION'),
              CpCard(
                child: Column(
                  children: [
                    _InfoRow('Status', switch (client.phase) {
                      RemotePhase.connected => 'Connected',
                      RemotePhase.connecting => 'Connecting…',
                      RemotePhase.reconnecting => 'Reconnecting…',
                      RemotePhase.failed => 'Disconnected',
                      RemotePhase.idle => 'Not connected',
                    }),
                    _InfoRow(
                      'Desktop',
                      client.hello?.serverName ??
                          client.target?.name ??
                          'Not paired',
                    ),
                    _InfoRow(
                      'Address',
                      client.target == null
                          ? '—'
                          : '${client.target!.host}:${client.target!.port}',
                    ),
                    _InfoRow(
                      'Desktop version',
                      client.hello?.appVersion ?? '—',
                    ),
                    _InfoRow(
                      'Latency',
                      client.rttMs == null
                          ? '—'
                          : '${client.rttMs} ms (best ${client.rttBestMs ?? '—'} / avg ${client.rttAverageMs?.toStringAsFixed(1) ?? '—'} ms)',
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: client.isConnected
                                ? () => client.disconnect()
                                : null,
                            icon: const Icon(Icons.link_off, size: 18),
                            label: const Text('Disconnect'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _forgetDesktop,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: CpColors.danger,
                              side: BorderSide(
                                color: CpColors.danger.withValues(alpha: 0.45),
                              ),
                            ),
                            icon: const Icon(Icons.delete_outline, size: 18),
                            label: const Text('Forget'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Text(
                'Updates are downloaded directly from github.com/$releaseRepository. '
                'The remote has no analytics and never sends presentation data to a '
                'server.',
                style: const TextStyle(
                  color: CpColors.textMuted,
                  fontSize: 11,
                  height: 1.5,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          color: CpColors.textMuted,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _ReleaseCard extends StatelessWidget {
  const _ReleaseCard({
    required this.release,
    required this.updates,
    required this.onDownload,
    required this.onOpenPage,
  });

  final MobileRelease release;
  final UpdateService updates;
  final VoidCallback onDownload;
  final VoidCallback onOpenPage;

  bool get _isInstalled => release.version == AppInfo.version;
  bool get _isLatest => updates.latest?.tag == release.tag;
  bool get _isDownloading =>
      updates.isDownloading && updates.downloadingTag == release.tag;

  @override
  Widget build(BuildContext context) {
    return CpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'v${release.version}',
                style: const TextStyle(
                  color: CpColors.text,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 8),
              if (_isInstalled)
                const _Badge(label: 'INSTALLED', color: CpColors.success)
              else if (_isLatest)
                const _Badge(label: 'LATEST', color: CpColors.accent),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${_formatDate(release.publishedAt)} · ${_formatBytes(release.apkSize)}'
            ' · Android 7.0+ · universal APK',
            style: const TextStyle(color: CpColors.textMuted, fontSize: 11.5),
          ),
          if (release.notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              release.notes,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: CpColors.textMuted,
                fontSize: 12,
                height: 1.45,
              ),
            ),
          ],
          if (_isDownloading) ...[
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: updates.progress,
              backgroundColor: CpColors.surface,
              minHeight: 4,
              borderRadius: BorderRadius.circular(2),
            ),
            const SizedBox(height: 4),
            Text(
              updates.progress == null
                  ? 'Downloading…'
                  : '${(updates.progress! * 100).round()}%',
              style: const TextStyle(color: CpColors.textMuted, fontSize: 11),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (_isInstalled)
                const OutlinedButton(onPressed: null, child: Text('Installed'))
              else
                FilledButton.icon(
                  onPressed: _isDownloading ? null : onDownload,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 42),
                    backgroundColor: _isLatest
                        ? CpColors.accent
                        : CpColors.surfaceHigh,
                  ),
                  icon: const Icon(Icons.download, size: 17),
                  label: Text(_isLatest ? 'Download update' : 'Download APK'),
                ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: onOpenPage,
                child: const Text('Release page'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(color: CpColors.textMuted, fontSize: 12.5),
            ),
          ),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: CpColors.text, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatBytes(int bytes) {
  if (bytes <= 0) return 'size unknown';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

String _formatDate(DateTime date) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${date.day} ${months[date.month - 1]} ${date.year}';
}

String _formatDateTime(DateTime date) {
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '${_formatDate(date)} at $hour:$minute';
}
