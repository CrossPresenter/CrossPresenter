import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../core/app_info.dart';
import '../core/protocol.dart';
import '../core/remote_client.dart';
import 'library_screen.dart';
import 'settings_screen.dart';
import 'theme.dart';

/// The operator's main control surface once paired.
class RemoteScreen extends StatefulWidget {
  const RemoteScreen({super.key, required this.client});

  final RemoteClient client;

  @override
  State<RemoteScreen> createState() => _RemoteScreenState();
}

class _RemoteScreenState extends State<RemoteScreen> {
  String? _lastErrorShown;

  @override
  void initState() {
    super.initState();
    unawaited(WakelockPlus.enable());
    widget.client.addListener(_onClient);
  }

  void _onClient() {
    final error = widget.client.lastCommandError;
    if (error == null || error == _lastErrorShown || !mounted) return;
    _lastErrorShown = error;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
  }

  @override
  void dispose() {
    widget.client.removeListener(_onClient);
    unawaited(WakelockPlus.disable());
    super.dispose();
  }

  void _tap({bool strong = false}) {
    if (strong) {
      unawaited(HapticFeedback.mediumImpact());
    } else {
      unawaited(HapticFeedback.selectionClick());
    }
  }

  Future<void> _confirmStop() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: CpColors.surfaceHigh,
        title: const Text('Stop live output?'),
        content: const Text(
          'The projector will go back to the CrossPresenter idle screen. '
          'Nothing in your service is deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: CpColors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Stop'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      _tap(strong: true);
      widget.client.stopLive();
    }
  }

  void _showDiagnostics() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: CpColors.surface,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _DiagnosticsSheet(client: widget.client),
    );
  }

  void _openLibrary() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => LibraryScreen(client: widget.client)),
    );
  }

  void _openSettings() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => SettingsScreen(client: widget.client)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final client = widget.client;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              client.hello?.serverName ??
                  client.target?.name ??
                  'CrossPresenter',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              _statusLabel(client),
              style: TextStyle(
                color: _statusColor(client),
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          _RttBadge(client: client),
          const SizedBox(width: 4),
          IconButton(
            tooltip: 'Diagnostics',
            onPressed: _showDiagnostics,
            icon: const Icon(Icons.tune),
          ),
          IconButton(
            tooltip: 'Settings',
            onPressed: _openSettings,
            icon: const Icon(Icons.settings_outlined),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: AnimatedBuilder(
        animation: client,
        builder: (context, _) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              if (!client.isConnected) ...[
                _ReconnectBanner(client: client),
                const SizedBox(height: 12),
              ],
              _LiveCard(client: client),
              const SizedBox(height: 14),
              _TransportControls(client: client, onTap: _tap),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _ActionTile(
                      icon: Icons.visibility_off_outlined,
                      label: 'Black',
                      active: client.state.live.blank,
                      onTap: client.isConnected
                          ? () {
                              _tap();
                              client.toggleBlack();
                            }
                          : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _ActionTile(
                      icon: Icons.text_fields,
                      label: 'Clear text',
                      active: client.state.live.clearText,
                      onTap: client.isConnected
                          ? () {
                              _tap();
                              client.toggleClearText();
                            }
                          : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _ActionTile(
                      icon: Icons.wallpaper_outlined,
                      label: 'Clear bg',
                      active: client.state.live.clearBackground,
                      onTap: client.isConnected
                          ? () {
                              _tap();
                              client.toggleClearBackground();
                            }
                          : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: client.isConnected ? _confirmStop : null,
                icon: const Icon(Icons.stop_circle_outlined),
                label: const Text('Stop live output'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: CpColors.danger,
                  side: BorderSide(
                    color: CpColors.danger.withValues(alpha: 0.45),
                  ),
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  const Text(
                    'SERVICE',
                    style: TextStyle(
                      color: CpColors.textMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: client.isConnected ? _openLibrary : null,
                    icon: const Icon(Icons.search, size: 18),
                    label: const Text('Library'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              _ServiceItems(client: client, onTap: _tap),
              const SizedBox(height: 22),
              Row(
                children: [
                  const Icon(
                    Icons.lock_outline,
                    size: 14,
                    color: CpColors.textMuted,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Local Wi-Fi only · protocol v${client.hello?.protocol ?? protocolVersion}'
                      ' · app v${AppInfo.version}',
                      style: const TextStyle(
                        color: CpColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

String _statusLabel(RemoteClient client) {
  switch (client.phase) {
    case RemotePhase.connected:
      final version = client.hello?.appVersion;
      return version == null ? 'Connected' : 'Connected · desktop v$version';
    case RemotePhase.connecting:
      return 'Connecting…';
    case RemotePhase.reconnecting:
      return 'Reconnecting…';
    case RemotePhase.failed:
      return 'Disconnected';
    case RemotePhase.idle:
      return 'Not connected';
  }
}

Color _statusColor(RemoteClient client) {
  switch (client.phase) {
    case RemotePhase.connected:
      return CpColors.success;
    case RemotePhase.connecting:
    case RemotePhase.reconnecting:
      return CpColors.warning;
    case RemotePhase.failed:
    case RemotePhase.idle:
      return CpColors.danger;
  }
}

class _RttBadge extends StatelessWidget {
  const _RttBadge({required this.client});
  final RemoteClient client;

  @override
  Widget build(BuildContext context) {
    final rtt = client.rttMs;
    final color = rtt == null
        ? CpColors.textMuted
        : rtt <= 30
        ? CpColors.success
        : rtt <= 80
        ? CpColors.warning
        : CpColors.danger;
    return AnimatedBuilder(
      animation: client,
      builder: (context, _) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: CpColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: CpColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.bolt, size: 13, color: color),
            const SizedBox(width: 3),
            Text(
              client.rttMs == null ? '—' : '${client.rttMs} ms',
              style: TextStyle(
                color: color,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReconnectBanner extends StatelessWidget {
  const _ReconnectBanner({required this.client});
  final RemoteClient client;

  @override
  Widget build(BuildContext context) {
    final failed = client.phase == RemotePhase.failed;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: (failed ? CpColors.danger : CpColors.warning).withValues(
          alpha: 0.1,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: (failed ? CpColors.danger : CpColors.warning).withValues(
            alpha: 0.4,
          ),
        ),
      ),
      child: Row(
        children: [
          if (failed)
            const Icon(Icons.link_off, color: CpColors.danger, size: 20)
          else
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  failed ? 'Disconnected' : 'Reconnecting…',
                  style: TextStyle(
                    color: failed ? CpColors.danger : CpColors.warning,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                if (client.error != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    client.error!,
                    style: const TextStyle(
                      color: CpColors.textMuted,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ],
            ),
          ),
          TextButton(
            onPressed: () => client.disconnect(),
            child: const Text('Back'),
          ),
        ],
      ),
    );
  }
}

class _LiveCard extends StatelessWidget {
  const _LiveCard({required this.client});
  final RemoteClient client;

  @override
  Widget build(BuildContext context) {
    final live = client.state.live;
    final slide = client.state.slide;
    final preview = client.previewJpeg;

    return CpCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _Pill(
                label: live.active ? 'LIVE' : 'IDLE',
                color: live.active ? CpColors.danger : CpColors.textMuted,
              ),
              if (live.blank) ...[
                const SizedBox(width: 8),
                const _Pill(label: 'BLACK', color: CpColors.textMuted),
              ],
              if (live.clearText) ...[
                const SizedBox(width: 8),
                const _Pill(label: 'NO TEXT', color: CpColors.warning),
              ],
              const Spacer(),
              if (live.slideCount > 0)
                Text(
                  '${live.slideIndex + 1} / ${live.slideCount}',
                  style: const TextStyle(
                    color: CpColors.textMuted,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          if (preview != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Image.memory(
                  preview,
                  gaplessPlayback: true,
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            live.itemTitle ??
                (live.active ? 'Live output' : 'Nothing on screen'),
            style: const TextStyle(
              color: CpColors.text,
              fontSize: 19,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.2,
            ),
          ),
          if (live.slideCount > 0) ...[
            const SizedBox(height: 3),
            Text(
              slide?.label ?? 'Slide ${live.slideIndex + 1}',
              style: const TextStyle(color: CpColors.accent, fontSize: 12.5),
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (live.slideIndex + 1) / live.slideCount,
                minHeight: 3,
                backgroundColor: CpColors.surfaceHigh,
              ),
            ),
          ],
          if (live.blank) ...[
            const SizedBox(height: 14),
            const Text(
              'The projector is blacked out.',
              style: TextStyle(color: CpColors.textMuted, fontSize: 13),
            ),
          ] else if (slide != null) ...[
            const SizedBox(height: 14),
            Text(
              slide.lines.take(4).join('\n'),
              style: const TextStyle(
                color: CpColors.text,
                fontSize: 15,
                height: 1.45,
              ),
            ),
            if (slide.nextLine != null) ...[
              const SizedBox(height: 10),
              Text(
                'Next: ${slide.nextLine}',
                style: const TextStyle(color: CpColors.textMuted, fontSize: 12),
              ),
            ],
          ] else ...[
            const SizedBox(height: 8),
            const Text(
              'Pick a song or service item below, then use Next to project it.',
              style: TextStyle(
                color: CpColors.textMuted,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _TransportControls extends StatelessWidget {
  const _TransportControls({required this.client, required this.onTap});
  final RemoteClient client;
  final void Function({bool strong}) onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = client.isConnected;
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: enabled
                ? () {
                    onTap(strong: true);
                    client.previousSlide();
                  }
                : null,
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 66)),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.arrow_back, size: 22),
                SizedBox(width: 6),
                Text('Previous'),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          flex: 2,
          child: FilledButton(
            onPressed: enabled
                ? () {
                    onTap(strong: true);
                    client.nextSlide();
                  }
                : null,
            style: FilledButton.styleFrom(minimumSize: const Size(0, 66)),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Next',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                SizedBox(width: 6),
                Icon(Icons.arrow_forward, size: 22),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Material(
      color: active ? CpColors.accentSoft : CpColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          height: 62,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: active
                  ? CpColors.accent.withValues(alpha: 0.6)
                  : CpColors.border,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 20,
                color: enabled
                    ? (active ? CpColors.accent : CpColors.text)
                    : CpColors.textMuted.withValues(alpha: 0.4),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: enabled
                      ? (active ? CpColors.accent : CpColors.textMuted)
                      : CpColors.textMuted.withValues(alpha: 0.4),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceItems extends StatelessWidget {
  const _ServiceItems({required this.client, required this.onTap});
  final RemoteClient client;
  final void Function({bool strong}) onTap;

  @override
  Widget build(BuildContext context) {
    final items = client.state.show.items;
    if (items.isEmpty) {
      return const CpCard(
        child: Text(
          'The service is empty. Add songs on the laptop, then pull to refresh '
          'here — the list updates automatically.',
          style: TextStyle(
            color: CpColors.textMuted,
            fontSize: 12.5,
            height: 1.5,
          ),
        ),
      );
    }
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = items[index];
          final selected = client.state.live.itemId == item.id;
          return ChoiceChip(
            label: Text(item.title),
            selected: selected,
            onSelected: client.isConnected
                ? (_) {
                    onTap();
                    client.projectItem(item.id);
                  }
                : null,
            showCheckmark: false,
            backgroundColor: CpColors.surface,
            selectedColor: CpColors.accentSoft,
            side: BorderSide(
              color: selected
                  ? CpColors.accent.withValues(alpha: 0.6)
                  : CpColors.border,
            ),
            labelStyle: TextStyle(
              color: selected ? CpColors.accent : CpColors.textMuted,
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
            ),
          );
        },
      ),
    );
  }
}

class _DiagnosticsSheet extends StatelessWidget {
  const _DiagnosticsSheet({required this.client});
  final RemoteClient client;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: client,
      builder: (context, _) {
        final connectedFor = client.connectedAt == null
            ? null
            : DateTime.now().difference(client.connectedAt!);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Connection',
                  style: TextStyle(
                    color: CpColors.text,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 14),
                _InfoRow(
                  'Desktop',
                  client.hello?.serverName ?? client.target?.name ?? '—',
                ),
                _InfoRow(
                  'Address',
                  client.target == null
                      ? '—'
                      : '${client.target!.host}:${client.target!.port}',
                ),
                _InfoRow('Desktop version', client.hello?.appVersion ?? '—'),
                _InfoRow(
                  'Protocol',
                  'v${client.hello?.protocol ?? protocolVersion}',
                ),
                _InfoRow('This app', AppInfo.label),
                _InfoRow(
                  'Latency',
                  client.rttMs == null ? '—' : '${client.rttMs} ms',
                ),
                _InfoRow(
                  'Latency min / avg / max',
                  client.rttBestMs == null
                      ? '—'
                      : '${client.rttBestMs} / ${client.rttAverageMs?.toStringAsFixed(1)} / ${client.rttWorstMs} ms',
                ),
                if (connectedFor != null)
                  _InfoRow('Connected for', _formatDuration(connectedFor)),
                const SizedBox(height: 18),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: CpColors.danger,
                  ),
                  onPressed: () async {
                    await client.disconnect();
                    if (context.mounted) Navigator.pop(context);
                  },
                  icon: const Icon(Icons.link_off),
                  label: const Text('Disconnect'),
                ),
              ],
            ),
          ),
        );
      },
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
            width: 148,
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

String _formatDuration(Duration duration) {
  final hours = duration.inHours;
  final minutes = duration.inMinutes.remainder(60);
  final seconds = duration.inSeconds.remainder(60);
  if (hours > 0) return '${hours}h ${minutes}m';
  if (minutes > 0) return '${minutes}m ${seconds}s';
  return '${seconds}s';
}
