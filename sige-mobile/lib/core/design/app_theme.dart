import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

abstract final class SigeTheme {
  static ThemeData get light => forBrand();

  static ThemeData forBrand({Color primary = SigeColors.blue}) {
    final accessiblePrimary = _accessible(primary);
    final pastelCanvas = Color.alphaBlend(
      accessiblePrimary.withValues(alpha: .045),
      const Color(0xFFFFFCF8),
    );
    final textTheme = GoogleFonts.nunitoSansTextTheme().copyWith(
      displaySmall: GoogleFonts.nunitoSans(
        fontSize: 34,
        height: 1.08,
        fontWeight: FontWeight.w800,
        color: SigeColors.ink,
        letterSpacing: -1.1,
      ),
      headlineSmall: GoogleFonts.nunitoSans(
        fontSize: 24,
        height: 1.15,
        fontWeight: FontWeight.w800,
        color: SigeColors.ink,
        letterSpacing: -.4,
      ),
      titleLarge: GoogleFonts.nunitoSans(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: SigeColors.ink,
      ),
      bodyLarge: GoogleFonts.nunitoSans(
        fontSize: 16,
        height: 1.45,
        fontWeight: FontWeight.w500,
        color: SigeColors.ink,
      ),
      bodyMedium: GoogleFonts.nunitoSans(
        fontSize: 14,
        height: 1.4,
        fontWeight: FontWeight.w500,
        color: SigeColors.slate,
      ),
      labelLarge: GoogleFonts.nunitoSans(
        fontSize: 15,
        fontWeight: FontWeight.w800,
      ),
    );
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: color, width: width),
        );
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: pastelCanvas,
      colorScheme: ColorScheme.fromSeed(
        seedColor: accessiblePrimary,
        primary: accessiblePrimary,
        secondary: _derivedAccent(accessiblePrimary),
        tertiary: SigeColors.amber,
        surface: SigeColors.surface,
        error: SigeColors.danger,
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: Colors.transparent,
        foregroundColor: SigeColors.ink,
        titleTextStyle: textTheme.titleLarge,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        labelStyle: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: const Color(0xFF8FA1B4),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 17,
        ),
        border: border(SigeColors.line),
        enabledBorder: border(SigeColors.line),
        focusedBorder: border(accessiblePrimary, 2),
        errorBorder: border(SigeColors.danger),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: Colors.white,
        indicatorColor: accessiblePrimary.withValues(alpha: .14),
        labelTextStyle: WidgetStatePropertyAll(
          textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? accessiblePrimary : SigeColors.slate,
            size: selected ? 26 : 24,
          );
        }),
      ),
      iconTheme: IconThemeData(color: accessiblePrimary),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: accessiblePrimary,
        foregroundColor: Colors.white,
      ),
    );
  }

  static Color _accessible(Color color) {
    final hsl = HSLColor.fromColor(color);
    if (hsl.lightness <= .48) return color;
    return hsl
        .withLightness(.42)
        .withSaturation(hsl.saturation.clamp(.45, .9))
        .toColor();
  }

  static Color _derivedAccent(Color color) {
    final hsl = HSLColor.fromColor(color);
    return hsl
        .withHue((hsl.hue + 18) % 360)
        .withSaturation((hsl.saturation * .78).clamp(.38, .78))
        .withLightness(.46)
        .toColor();
  }
}
