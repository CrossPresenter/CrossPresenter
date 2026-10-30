import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/remote_client.dart';
import 'core/update_service.dart';
import 'state/providers.dart';
import 'ui/connect_screen.dart';
import 'ui/remote_screen.dart';
import 'ui/theme.dart';
import 'ui/update_dialog.dart';

class CrossPresenterRemoteApp extends StatelessWidget {
  const CrossPresenterRemoteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CrossPresenter Remote',
      debugShowCheckedModeBanner: false,
      theme: buildCpTheme(),
      home: const RootGate(),
    );
  }
}

/// Pairing until a connection has been established, then the remote. A dropped
/// link keeps the remote on screen with a reconnect banner: the operator should
/// never be thrown back to a form mid-service.
///
/// This is also where the startup update check lives, so the popup appears
/// whether or not a desktop is currently paired.
class RootGate extends ConsumerStatefulWidget {
  const RootGate({super.key});

  @override
  ConsumerState<RootGate> createState() => _RootGateState();
}

class _RootGateState extends ConsumerState<RootGate> {
  static const _skipKey = 'cp.remote.skipUpdateVersion';

  late final UpdateService _updates;
  bool _started = false;
  bool _prompted = false;

  @override
  void initState() {
    super.initState();
    _updates = ref.read(updateServiceProvider);
    _updates.addListener(_onUpdateChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _startupCheck());
  }

  Future<void> _startupCheck() async {
    if (_started) return;
    _started = true;
    await _updates.init();
    // Automatic checks fail quietly: the app is often used on a LAN with no
    // internet, and an error toast every launch would be noise.
    await _updates.check();
  }

  void _onUpdateChanged() {
    unawaited(_maybePrompt());
  }

  Future<void> _maybePrompt() async {
    if (!mounted || _prompted) return;
    if (_updates.phase != UpdatePhase.available || _updates.latest == null) {
      return;
    }
    // A manual check from Settings shows its own dialog.
    if (_updates.lastCheckUserInitiated) return;

    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    if (prefs.getString(_skipKey) == _updates.latest!.version) return;

    _prompted = true;
    await showUpdatePrompt(
      context,
      _updates,
      onLater: () async {
        final prefs = await SharedPreferences.getInstance();
        final version = _updates.latest?.version;
        if (version != null) {
          await prefs.setString(_skipKey, version);
        }
      },
    );
  }

  @override
  void dispose() {
    _updates.removeListener(_onUpdateChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final client = ref.watch(remoteClientProvider);
    return AnimatedBuilder(
      animation: client,
      builder: (context, _) {
        final keepRemote =
            client.isConnected ||
            client.phase == RemotePhase.reconnecting ||
            (client.phase == RemotePhase.failed && client.connectedAt != null);
        return keepRemote
            ? RemoteScreen(client: client)
            : ConnectScreen(client: client);
      },
    );
  }
}
