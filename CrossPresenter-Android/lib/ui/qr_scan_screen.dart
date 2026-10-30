import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../core/protocol.dart';
import 'theme.dart';

/// Camera scanner that accepts only CrossPresenter pairing links.
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _handled = false;
  bool _torchOn = false;
  String? _hint;

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null || raw.isEmpty) continue;
      final target = PairTarget.fromPairingUri(raw);
      if (target != null) {
        _handled = true;
        HapticFeedback.mediumImpact();
        Navigator.of(context).pop(target);
        return;
      }
      if (mounted) {
        setState(
          () => _hint = 'That QR code is not a CrossPresenter pairing code.',
        );
      }
    }
  }

  Future<void> _toggleTorch() async {
    await _controller.toggleTorch();
    if (mounted) setState(() => _torchOn = !_torchOn);
  }

  @override
  void dispose() {
    unawaited(_controller.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan pairing QR'),
        backgroundColor: Colors.black,
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          // Dim everything outside a square "aim here" window.
          IgnorePointer(
            child: Center(
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: CpColors.accent, width: 2),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black54,
                      blurRadius: 40,
                      spreadRadius: 40,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            bottom: 72,
            child: Column(
              children: [
                if (_hint != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: CpColors.danger.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _hint!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                const Text(
                  'Point the camera at the QR shown on the laptop',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: CpColors.text, fontSize: 14),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Settings → Remote Control → Show pairing QR',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: CpColors.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          Positioned(
            right: 16,
            bottom: 16,
            child: IconButton.filledTonal(
              onPressed: _toggleTorch,
              tooltip: _torchOn ? 'Turn torch off' : 'Turn torch on',
              icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            ),
          ),
        ],
      ),
    );
  }
}
