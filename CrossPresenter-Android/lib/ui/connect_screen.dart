import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/protocol.dart';
import '../core/remote_client.dart';
import '../core/storage.dart';
import '../state/providers.dart';
import 'qr_scan_screen.dart';
import 'settings_screen.dart';
import 'theme.dart';

/// First-run screen: QR pairing, last-desktop reconnect, or manual entry.
class ConnectScreen extends ConsumerStatefulWidget {
  const ConnectScreen({super.key, required this.client});

  final RemoteClient client;

  @override
  ConsumerState<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends ConsumerState<ConnectScreen> {
  final _host = TextEditingController();
  final _port = TextEditingController(text: '$defaultRemotePort');
  final _token = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  PairTarget? _saved;
  bool _loadingSaved = true;
  bool _showManual = false;
  bool _submitting = false;
  bool _autoTried = false;

  TargetStore get _store => ref.read(targetStoreProvider);

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final saved = await _store.load();
    if (!mounted) return;
    setState(() {
      _saved = saved;
      _loadingSaved = false;
      if (saved != null) {
        _host.text = saved.host;
        _port.text = '${saved.port}';
        _token.text = saved.token;
      }
    });
    // Reconnect once on launch so a returning operator does not have to tap.
    if (saved != null && !_autoTried) {
      _autoTried = true;
      await _connect(saved, remember: false);
    }
  }

  Future<void> _connect(PairTarget target, {bool remember = true}) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    await widget.client.connect(
      target,
      deviceId: await _store.deviceId(),
      deviceName: await _store.deviceName(),
    );
    if (!mounted) return;
    if (widget.client.isConnected && remember) {
      await _store.save(target);
      if (!mounted) return;
      setState(() => _saved = target);
    }
    if (mounted) setState(() => _submitting = false);
  }

  Future<void> _scan() async {
    final target = await Navigator.of(
      context,
    ).push<PairTarget>(MaterialPageRoute(builder: (_) => const QrScanScreen()));
    if (target != null && mounted) {
      await _connect(target);
    }
  }

  Future<void> _forget() async {
    await _store.clear();
    if (!mounted) return;
    setState(() {
      _saved = null;
      _token.clear();
    });
  }

  void _connectManual() {
    if (!_formKey.currentState!.validate()) return;
    _connect(
      PairTarget(
        host: _host.text.trim(),
        port: int.parse(_port.text.trim()),
        token: _token.text.trim(),
      ),
    );
  }

  void _openSettings() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => SettingsScreen(client: widget.client)),
    );
  }

  @override
  void dispose() {
    _host.dispose();
    _port.dispose();
    _token.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final client = widget.client;
    final busy = _submitting || client.phase == RemotePhase.connecting;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Expanded(child: _BrandHeader()),
                  IconButton(
                    tooltip: 'Settings and updates',
                    onPressed: _openSettings,
                    icon: const Icon(Icons.settings_outlined),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              if (_loadingSaved)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else if (_saved != null) ...[
                _SavedDesktopCard(
                  target: _saved!,
                  busy: busy,
                  onConnect: () => _connect(_saved!),
                  onForget: _forget,
                ),
                const SizedBox(height: 16),
              ],
              FilledButton.icon(
                onPressed: busy ? null : _scan,
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scan pairing QR'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () => setState(() => _showManual = !_showManual),
                icon: const Icon(Icons.keyboard_alt_outlined),
                label: Text(
                  _showManual ? 'Hide manual entry' : 'Enter address manually',
                ),
              ),
              if (_showManual) ...[
                const SizedBox(height: 16),
                _ManualForm(
                  formKey: _formKey,
                  host: _host,
                  port: _port,
                  token: _token,
                  busy: busy,
                  onSubmit: _connectManual,
                ),
              ],
              if (busy || client.error != null) ...[
                const SizedBox(height: 16),
                _StatusCard(
                  busy: busy,
                  error: client.error,
                  target: client.target,
                  onRetry: client.target == null
                      ? null
                      : () => _connect(client.target!, remember: false),
                ),
              ],
              const SizedBox(height: 24),
              const _HowToPair(),
            ],
          ),
        ),
      ),
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [CpColors.accent, Color(0xFF4F8CFF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(
            Icons.cast_connected,
            color: Colors.white,
            size: 28,
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'CrossPresenter',
          style: TextStyle(
            color: CpColors.text,
            fontSize: 30,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Remote',
          style: TextStyle(
            color: CpColors.accent,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Control the projector from your phone. Works only on the same Wi-Fi '
          'as the laptop — no internet, no account.',
          style: TextStyle(
            color: CpColors.textMuted,
            fontSize: 14,
            height: 1.5,
          ),
        ),
      ],
    );
  }
}

class _SavedDesktopCard extends StatelessWidget {
  const _SavedDesktopCard({
    required this.target,
    required this.busy,
    required this.onConnect,
    required this.onForget,
  });

  final PairTarget target;
  final bool busy;
  final VoidCallback onConnect;
  final VoidCallback onForget;

  @override
  Widget build(BuildContext context) {
    return CpCard(
      child: Row(
        children: [
          const Icon(Icons.computer, color: CpColors.textMuted),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  target.name?.isNotEmpty == true
                      ? target.name!
                      : 'Last desktop',
                  style: const TextStyle(
                    color: CpColors.text,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${target.host}:${target.port}',
                  style: const TextStyle(
                    color: CpColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: busy ? null : onForget,
            child: const Text('Forget'),
          ),
          const SizedBox(width: 4),
          FilledButton(
            onPressed: busy ? null : onConnect,
            style: FilledButton.styleFrom(minimumSize: const Size(0, 42)),
            child: const Text('Reconnect'),
          ),
        ],
      ),
    );
  }
}

class _ManualForm extends StatelessWidget {
  const _ManualForm({
    required this.formKey,
    required this.host,
    required this.port,
    required this.token,
    required this.busy,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController host;
  final TextEditingController port;
  final TextEditingController token;
  final bool busy;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        children: [
          TextFormField(
            controller: host,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'Desktop IP',
              hintText: '192.168.1.42',
            ),
            validator: (value) => (value == null || value.trim().isEmpty)
                ? 'Enter the laptop IP'
                : null,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: port,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Port'),
                  validator: (value) {
                    final parsed = int.tryParse(value?.trim() ?? '');
                    if (parsed == null || parsed <= 0 || parsed > 65535) {
                      return '1–65535';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: TextFormField(
                  controller: token,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Pairing token',
                    hintText: 'From the laptop',
                  ),
                  validator: (value) => (value == null || value.trim().isEmpty)
                      ? 'Required'
                      : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy ? null : onSubmit,
            child: const Text('Connect'),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.busy,
    required this.error,
    required this.target,
    required this.onRetry,
  });

  final bool busy;
  final String? error;
  final PairTarget? target;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    if (busy) {
      return CpCard(
        child: Row(
          children: [
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                target == null
                    ? 'Connecting…'
                    : 'Connecting to ${target!.name ?? target!.host}…',
                style: const TextStyle(color: CpColors.textMuted),
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: CpColors.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: CpColors.danger.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.error_outline, color: CpColors.danger, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  error ?? 'Could not connect.',
                  style: const TextStyle(color: CpColors.danger, fontSize: 13),
                ),
              ),
            ],
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onRetry,
                child: const Text('Try again'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HowToPair extends StatelessWidget {
  const _HowToPair();

  @override
  Widget build(BuildContext context) {
    return CpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.info_outline, size: 18, color: CpColors.textMuted),
              SizedBox(width: 8),
              Text(
                'How to pair',
                style: TextStyle(
                  color: CpColors.text,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '1. Keep the laptop and phone on the same Wi-Fi.\n'
            '2. On the laptop: Settings → Remote Control → Show pairing QR.\n'
            '3. Scan it here. The pairing stays remembered.',
            style: TextStyle(
              color: CpColors.textMuted.withValues(alpha: 0.95),
              fontSize: 12.5,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
