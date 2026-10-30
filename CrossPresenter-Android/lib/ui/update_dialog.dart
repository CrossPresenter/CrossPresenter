import 'package:flutter/material.dart';

import '../core/app_info.dart';
import '../core/update_service.dart';
import 'theme.dart';

/// Show the "new version available" dialog. The caller decides whether this is
/// a startup prompt (and remembers a "Later" choice) or a manual check.
Future<void> showUpdatePrompt(
  BuildContext context,
  UpdateService service, {
  VoidCallback? onLater,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (context) =>
        UpdatePromptDialog(service: service, onLater: onLater),
  );
}

class UpdatePromptDialog extends StatelessWidget {
  const UpdatePromptDialog({super.key, required this.service, this.onLater});

  final UpdateService service;
  final VoidCallback? onLater;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: CpColors.surfaceHigh,
      icon: const Icon(Icons.system_update, color: CpColors.accent, size: 30),
      title: const Text('Update available'),
      content: AnimatedBuilder(
        animation: service,
        builder: (context, _) {
          final release = service.latest;
          if (release == null) {
            return const Text('No release information is available.');
          }
          final downloading = service.phase == UpdatePhase.downloading;
          final ready = service.phase == UpdatePhase.ready;
          return SizedBox(
            width: 340,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'CrossPresenter Remote v${release.version}',
                    style: const TextStyle(
                      color: CpColors.text,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Installed: ${AppInfo.label} · '
                    '${_formatBytes(release.apkSize)} · ${_formatDate(release.publishedAt)}',
                    style: const TextStyle(
                      color: CpColors.textMuted,
                      fontSize: 12,
                    ),
                  ),
                  if (release.notes.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 180),
                      child: SingleChildScrollView(
                        child: Text(
                          release.notes,
                          style: const TextStyle(
                            color: CpColors.text,
                            fontSize: 12.5,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                  if (downloading) ...[
                    const SizedBox(height: 16),
                    LinearProgressIndicator(
                      value: service.progress,
                      backgroundColor: CpColors.surface,
                      minHeight: 6,
                      borderRadius: BorderRadius.circular(3),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      service.progress == null
                          ? 'Downloading…'
                          : 'Downloading ${(service.progress! * 100).round()}%',
                      style: const TextStyle(
                        color: CpColors.textMuted,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                  if (ready) ...[
                    const SizedBox(height: 14),
                    const Text(
                      'Downloaded. Finish the install in Android, then reopen '
                      'CrossPresenter Remote.',
                      style: TextStyle(
                        color: CpColors.success,
                        fontSize: 12.5,
                        height: 1.45,
                      ),
                    ),
                  ],
                  if (service.phase == UpdatePhase.error &&
                      service.error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: CpColors.danger.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        service.error!,
                        style: const TextStyle(
                          color: CpColors.danger,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
      actions: [
        TextButton(
          onPressed: service.phase == UpdatePhase.downloading
              ? null
              : () {
                  onLater?.call();
                  Navigator.of(context).pop();
                },
          child: const Text('Later'),
        ),
        AnimatedBuilder(
          animation: service,
          builder: (context, _) {
            final release = service.latest;
            final downloading = service.phase == UpdatePhase.downloading;
            final ready =
                service.phase == UpdatePhase.ready ||
                (service.downloadedPath != null &&
                    service.downloadedVersion == release?.version);
            final error = service.phase == UpdatePhase.error;

            if (ready && !downloading) {
              return FilledButton.icon(
                onPressed: () => service.installDownloaded(),
                icon: const Icon(Icons.install_mobile, size: 18),
                label: const Text('Open installer'),
              );
            }
            return FilledButton.icon(
              onPressed: downloading || release == null
                  ? null
                  : () => service.downloadAndInstall(release),
              icon: downloading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(error ? Icons.refresh : Icons.download, size: 18),
              label: Text(
                downloading
                    ? 'Downloading…'
                    : error
                    ? 'Retry'
                    : 'Download & install',
              ),
            );
          },
        ),
      ],
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
