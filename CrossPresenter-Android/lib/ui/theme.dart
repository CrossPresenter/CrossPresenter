import 'package:flutter/material.dart';

/// Desktop-matching palette: near-black shell, violet accent, calm greys.
abstract final class CpColors {
  static const background = Color(0xFF0B0C10);
  static const surface = Color(0xFF14161D);
  static const surfaceHigh = Color(0xFF1B1E27);
  static const border = Color(0xFF272B36);
  static const accent = Color(0xFF7C6AF7);
  static const accentSoft = Color(0xFF2A2547);
  static const text = Color(0xFFF4F4F8);
  static const textMuted = Color(0xFF9AA0AE);
  static const success = Color(0xFF4ADE80);
  static const warning = Color(0xFFFBBF24);
  static const danger = Color(0xFFF87171);
}

ThemeData buildCpTheme() {
  final scheme =
      ColorScheme.fromSeed(
        seedColor: CpColors.accent,
        brightness: Brightness.dark,
      ).copyWith(
        primary: CpColors.accent,
        surface: CpColors.surface,
        onSurface: CpColors.text,
        error: CpColors.danger,
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: CpColors.background,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: CpColors.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: CpColors.text,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: IconThemeData(color: CpColors.textMuted),
    ),
    textTheme: const TextTheme(
      bodyMedium: TextStyle(color: CpColors.text, fontSize: 14),
      bodySmall: TextStyle(color: CpColors.textMuted, fontSize: 12),
      titleMedium: TextStyle(
        color: CpColors.text,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: CpColors.surface,
      hintStyle: const TextStyle(color: CpColors.textMuted),
      labelStyle: const TextStyle(color: CpColors.textMuted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: CpColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: CpColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: CpColors.accent, width: 1.4),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 50),
        foregroundColor: CpColors.text,
        side: const BorderSide(color: CpColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: CpColors.surfaceHigh,
      contentTextStyle: const TextStyle(color: CpColors.text),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dividerTheme: const DividerThemeData(color: CpColors.border, space: 1),
  );
}

/// Small reusable panel used by the remote and library screens.
class CpCard extends StatelessWidget {
  const CpCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: CpColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CpColors.border),
      ),
      child: child,
    );
  }
}
