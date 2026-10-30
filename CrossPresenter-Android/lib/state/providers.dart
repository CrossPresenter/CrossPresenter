import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/remote_client.dart';
import '../core/storage.dart';
import '../core/update_service.dart';

/// One client for the whole app; screens observe it with an `AnimatedBuilder`.
final remoteClientProvider = Provider<RemoteClient>((ref) {
  final client = RemoteClient();
  ref.onDispose(client.dispose);
  return client;
});

final targetStoreProvider = Provider<TargetStore>((ref) => TargetStore());

final updateServiceProvider = Provider<UpdateService>((ref) {
  final service = UpdateService();
  ref.onDispose(service.dispose);
  return service;
});
