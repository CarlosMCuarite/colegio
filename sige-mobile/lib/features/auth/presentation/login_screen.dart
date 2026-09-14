import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/cache/school_identity_cache.dart';
import '../../../core/config/app_config.dart';
import '../../../core/design/app_colors.dart';
import 'auth_controller.dart';

final schoolIdentityProvider = FutureProvider<Map<String, dynamic>?>((
  ref,
) async {
  final client = await ref.watch(apiClientProvider.future);
  return SchoolIdentityCache.refresh(client.dio);
});

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  late final AnimationController _entrance;
  late final AnimationController _owlMotion;
  late final AnimationController _borderMotion;
  bool _obscurePassword = true;
  bool _rememberMe = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 720),
    )..forward();
    _owlMotion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    )..repeat(reverse: true);
    _borderMotion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 5000),
    )..repeat();
    _loadRememberedEmail();
  }

  Future<void> _loadRememberedEmail() async {
    final preferences = await SharedPreferences.getInstance();
    final remembered = preferences.getBool('remember_email') ?? false;
    if (!mounted) return;
    setState(() {
      _rememberMe = remembered;
      if (remembered) {
        _email.text = preferences.getString('remembered_email') ?? '';
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    _entrance.dispose();
    _owlMotion.dispose();
    _borderMotion.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  void didChangeMetrics() {
    final views = WidgetsBinding.instance.platformDispatcher.views;
    if (views.isEmpty) return;
    final keyboardOpen = views.first.viewInsets.bottom > 0;
    if (keyboardOpen) {
      _owlMotion.stop();
      _borderMotion.stop();
    } else {
      if (!_owlMotion.isAnimating) _owlMotion.repeat(reverse: true);
      if (!_borderMotion.isAnimating) _borderMotion.repeat();
    }
  }

  Future<void> _submit() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final preferences = await SharedPreferences.getInstance();
    await preferences.setBool('remember_email', _rememberMe);
    if (_rememberMe) {
      await preferences.setString('remembered_email', _email.text.trim());
    } else {
      await preferences.remove('remembered_email');
    }
    await ref
        .read(authControllerProvider.notifier)
        .login(_email.text.trim(), _password.text);
  }

  Future<void> _showRecoveryHelp() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CircleAvatar(
              radius: 25,
              backgroundColor: Color(0xFFE7F5FF),
              child: Icon(Icons.key_rounded, color: SigeColors.blue),
            ),
            const SizedBox(height: 16),
            Text(
              'Recupera tu acceso',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Solicita al administrador de tu colegio que restablezca tu contraseña desde SIGE.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Entendido'),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final identity =
        ref.watch(schoolIdentityProvider).valueOrNull ??
        SchoolIdentityCache.value;
    final primary =
        _parseColor(identity?['colorPrimario']?.toString()) ?? SigeColors.blue;
    final palette = _paletteFor(primary);
    final logoUrl = identity?['logoUrl']?.toString();
    final schoolName = identity?['nombre']?.toString() ?? AppConfig.schoolName;
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
      body: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth > constraints.maxHeight) {
            return _buildLandscape(
              context,
              constraints,
              auth: auth,
              palette: palette,
              logoUrl: logoUrl,
              schoolName: schoolName,
              reducedMotion: reducedMotion,
              keyboard: keyboard,
            );
          }
          final compact = constraints.maxHeight < 720;
          final cardTop = compact ? 310.0 : 365.0;
          final contentHeight = math.max(
            constraints.maxHeight + keyboard,
            cardTop + 510,
          );

          return SingleChildScrollView(
            padding: EdgeInsets.only(bottom: keyboard),
            child: SizedBox(
              height: contentHeight,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: Image.asset(
                      palette.background,
                      fit: BoxFit.cover,
                      alignment: Alignment.topCenter,
                    ),
                  ),
                  SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 18, 24, 0),
                      child: _SchoolHeader(
                        logoUrl: logoUrl,
                        schoolName: schoolName,
                        primary: palette.primary,
                      ),
                    ),
                  ),
                  Positioned(
                    left: 24,
                    top: MediaQuery.paddingOf(context).top + 18,
                    width: 64,
                    height: 64,
                    child: Material(
                      color: Colors.white,
                      elevation: 6,
                      shadowColor: Colors.black.withValues(alpha: .28),
                      borderRadius: BorderRadius.circular(16),
                      clipBehavior: Clip.antiAlias,
                      child: Padding(
                        padding: const EdgeInsets.all(5),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.asset(
                              'assets/images/school_logo_default.webp',
                              fit: BoxFit.contain,
                            ),
                            if (logoUrl != null && logoUrl.isNotEmpty)
                              Image.network(
                                logoUrl,
                                fit: BoxFit.contain,
                                errorBuilder: (_, _, _) =>
                                    const SizedBox.shrink(),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 25,
                    top: compact ? 132 : 150,
                    width: constraints.maxWidth * .58,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Tu colegio,\nsiempre contigo',
                          style: Theme.of(context).textTheme.headlineLarge
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                height: 1.05,
                                letterSpacing: -.8,
                              ),
                        ),
                        const SizedBox(height: 12),
                        Container(width: 38, height: 3, color: palette.accent),
                        const SizedBox(height: 10),
                        Text(
                          'Organización, comunicación y tranquilidad en un solo lugar.',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Colors.white.withValues(alpha: .84),
                                height: 1.35,
                              ),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    right: -30,
                    top: compact ? 125 : 138,
                    child: AnimatedBuilder(
                      animation: _owlMotion,
                      builder: (context, child) {
                        final t = reducedMotion ? .5 : _owlMotion.value;
                        final dy = math.sin(t * math.pi) * -7;
                        final angle = math.sin(t * math.pi * 2) * .012;
                        return Transform.translate(
                          offset: Offset(0, dy),
                          child: Transform.rotate(angle: angle, child: child),
                        );
                      },
                      child: Image.asset(
                        palette.owl,
                        width: constraints.maxWidth * .48,
                        height: constraints.maxWidth * .48,
                        fit: BoxFit.contain,
                        semanticLabel: 'Búho de bienvenida de SIGE',
                      ),
                    ),
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    top: cardTop,
                    child: AnimatedBuilder(
                      animation: _entrance,
                      builder: (context, child) {
                        final value = reducedMotion
                            ? 1.0
                            : Curves.easeOutCubic.transform(_entrance.value);
                        return Opacity(
                          opacity: value,
                          child: Transform.translate(
                            offset: Offset(0, 26 * (1 - value)),
                            child: child,
                          ),
                        );
                      },
                      child: _LoginCard(
                        formKey: _formKey,
                        email: _email,
                        password: _password,
                        primary: palette.primary,
                        auth: auth,
                        obscurePassword: _obscurePassword,
                        rememberMe: _rememberMe,
                        onTogglePassword: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                        onRememberChanged: (value) =>
                            setState(() => _rememberMe = value ?? false),
                        onRecovery: _showRecoveryHelp,
                        onSubmit: _submit,
                        compact: false,
                        borderMotion: _borderMotion,
                      ),
                    ),
                  ),
                  Positioned(
                    left: 24,
                    right: 24,
                    bottom: 44,
                    child: Column(
                      children: [
                        Text(
                          '© 2026 SIGE · Todos los derechos reservados',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: const Color(0xFF61708A),
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'CARCE',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: const Color(0xFF8A96AA),
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.8,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLandscape(
    BuildContext context,
    BoxConstraints constraints, {
    required AuthState auth,
    required _LoginPalette palette,
    required String? logoUrl,
    required String schoolName,
    required bool reducedMotion,
    required double keyboard,
  }) {
    final panelWidth = math.min(430.0, constraints.maxWidth * .46);
    final owlSize = math.min(250.0, constraints.maxHeight * .62);
    return SingleChildScrollView(
      padding: EdgeInsets.only(bottom: keyboard),
      child: SizedBox(
        width: constraints.maxWidth,
        height: math.max(constraints.maxHeight, 410),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              palette.background,
              fit: BoxFit.cover,
              alignment: const Alignment(0, -.72),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withValues(alpha: .38),
                    Colors.transparent,
                    Colors.black.withValues(alpha: .08),
                  ],
                  stops: const [0, .52, 1],
                ),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(28, 14, 28, 14),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: SizedBox(
                    width: constraints.maxWidth - panelWidth - 74,
                    child: _SchoolHeader(
                      logoUrl: logoUrl,
                      schoolName: schoolName,
                      primary: palette.primary,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 32,
              top: constraints.maxHeight * .31,
              width: constraints.maxWidth - panelWidth - 110,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tu colegio,\nsiempre contigo',
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      height: .98,
                      letterSpacing: -1.2,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(width: 42, height: 3, color: palette.accent),
                  const SizedBox(height: 9),
                  Text(
                    'Organización, comunicación y tranquilidad\nen un solo lugar.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: .84),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: constraints.maxWidth * .34,
              bottom: -owlSize * .15,
              child: AnimatedBuilder(
                animation: _owlMotion,
                builder: (context, child) {
                  final t = reducedMotion ? .5 : _owlMotion.value;
                  return Transform.translate(
                    offset: Offset(0, math.sin(t * math.pi) * -6),
                    child: child,
                  );
                },
                child: Image.asset(
                  palette.owl,
                  width: owlSize,
                  height: owlSize,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            Positioned(
              right: 26,
              top: 20,
              bottom: 20,
              width: panelWidth,
              child: AnimatedBuilder(
                animation: _entrance,
                builder: (context, child) {
                  final value = reducedMotion
                      ? 1.0
                      : Curves.easeOutCubic.transform(_entrance.value);
                  return Opacity(
                    opacity: value,
                    child: Transform.translate(
                      offset: Offset(22 * (1 - value), 0),
                      child: child,
                    ),
                  );
                },
                child: Center(
                  child: SingleChildScrollView(
                    child: _LoginCard(
                      formKey: _formKey,
                      email: _email,
                      password: _password,
                      primary: palette.primary,
                      auth: auth,
                      obscurePassword: _obscurePassword,
                      rememberMe: _rememberMe,
                      onTogglePassword: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                      onRememberChanged: (value) =>
                          setState(() => _rememberMe = value ?? false),
                      onRecovery: _showRecoveryHelp,
                      onSubmit: _submit,
                      compact: true,
                      borderMotion: _borderMotion,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color? _parseColor(String? value) {
    if (value == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value)) {
      return null;
    }
    return Color(int.parse('FF${value.substring(1)}', radix: 16));
  }

  _LoginPalette _paletteFor(Color color) {
    final hue = HSVColor.fromColor(color).hue;
    if (hue < 25 || hue >= 335) return _LoginPalette.red;
    if (hue >= 35 && hue < 75) return _LoginPalette.yellow;
    if (hue >= 75 && hue < 170) return _LoginPalette.green;
    return _LoginPalette.blue;
  }
}

class _SchoolHeader extends StatelessWidget {
  const _SchoolHeader({
    required this.logoUrl,
    required this.schoolName,
    required this.primary,
  });
  final String? logoUrl;
  final String schoolName;
  final Color primary;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(
        width: 64,
        height: 64,
        child: Material(
          color: Colors.white,
          elevation: 5,
          shadowColor: Colors.black.withValues(alpha: .28),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.all(5),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/images/school_logo_default.webp',
                  fit: BoxFit.contain,
                ),
                if (logoUrl != null && logoUrl!.isNotEmpty)
                  Image.network(
                    logoUrl!,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
              ],
            ),
          ),
        ),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              schoolName,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                height: 1.08,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Gestión escolar segura',
              style: TextStyle(
                color: Colors.white.withValues(alpha: .72),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.formKey,
    required this.email,
    required this.password,
    required this.primary,
    required this.auth,
    required this.obscurePassword,
    required this.rememberMe,
    required this.onTogglePassword,
    required this.onRememberChanged,
    required this.onRecovery,
    required this.onSubmit,
    required this.compact,
    required this.borderMotion,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController email;
  final TextEditingController password;
  final Color primary;
  final AuthState auth;
  final bool obscurePassword;
  final bool rememberMe;
  final VoidCallback onTogglePassword;
  final ValueChanged<bool?> onRememberChanged;
  final VoidCallback onRecovery;
  final VoidCallback onSubmit;
  final bool compact;
  final Animation<double> borderMotion;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: borderMotion,
    builder: (context, child) => CustomPaint(
      foregroundPainter: _ChasingBorderPainter(
        phase: borderMotion.value,
        color: primary,
        fast: auth.isSubmitting,
      ),
      child: child,
    ),
    child: Form(
      key: formKey,
      child: Container(
        padding: EdgeInsets.fromLTRB(20, compact ? 22 : 30, 20, 36),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .97),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: primary.withValues(alpha: .18),
              blurRadius: 30,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: compact ? 46 : 54,
                  height: compact ? 46 : 54,
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: .10),
                    shape: BoxShape.circle,
                  ),
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.school_outlined,
                      color: primary,
                      size: compact ? 23 : 27,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bienvenido a SIGE',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: -.4,
                        ),
                      ),
                      Text(
                        'Accede con tus credenciales institucionales',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: compact ? 14 : 22),
            TextFormField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(
                labelText: 'Correo institucional',
                hintText: 'nombre@colegio.edu',
                prefixIcon: Icon(Icons.mail_outline_rounded),
              ),
              validator: (value) {
                final mail = value?.trim() ?? '';
                if (mail.isEmpty) return 'Escribe el correo de tu cuenta.';
                if (!mail.contains('@')) return 'Ingresa un correo válido.';
                return null;
              },
            ),
            SizedBox(height: compact ? 12 : 16),
            TextFormField(
              controller: password,
              obscureText: obscurePassword,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              onFieldSubmitted: (_) => onSubmit(),
              decoration: InputDecoration(
                labelText: 'Contraseña',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  tooltip: obscurePassword
                      ? 'Mostrar contraseña'
                      : 'Ocultar contraseña',
                  onPressed: onTogglePassword,
                  icon: Icon(
                    obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                  ),
                ),
              ),
              validator: (value) =>
                  (value?.isEmpty ?? true) ? 'Escribe tu contraseña.' : null,
            ),
            Row(
              children: [
                Checkbox(
                  value: rememberMe,
                  activeColor: primary,
                  onChanged: auth.isSubmitting ? null : onRememberChanged,
                ),
                const Expanded(child: Text('Recordarme')),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: primary),
                  onPressed: auth.isSubmitting ? null : onRecovery,
                  child: const Text('¿Olvidaste tu clave?'),
                ),
              ],
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 180),
              child: auth.error == null
                  ? const SizedBox.shrink()
                  : Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEEEE),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        auth.error!,
                        style: const TextStyle(color: SigeColors.danger),
                      ),
                    ),
            ),
            SizedBox(
              height: compact ? 54 : 58,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
                onPressed: auth.isSubmitting ? null : onSubmit,
                icon: auth.isSubmitting
                    ? const SizedBox.square(
                        dimension: 19,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.arrow_forward_rounded),
                label: Text(
                  auth.isSubmitting ? 'Verificando acceso…' : 'Ingresar',
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ChasingBorderPainter extends CustomPainter {
  const _ChasingBorderPainter({
    required this.phase,
    required this.color,
    required this.fast,
  });

  final double phase;
  final Color color;
  final bool fast;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 8 || size.height <= 8) return;
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(2, 2, size.width - 4, size.height - 4),
          const Radius.circular(22),
        ),
      );
    final metric = path.computeMetrics().first;
    final length = metric.length;
    final normalized = ((fast ? phase * 2.5 : phase) % 1.0);
    final start = normalized * length;
    final segmentLength = length * .105;

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = color.withValues(alpha: .16),
    );

    _drawSegment(canvas, metric, start, segmentLength, color, length);
    _drawSegment(
      canvas,
      metric,
      (start + length * .5) % length,
      segmentLength,
      Color.lerp(color, Colors.white, .34)!,
      length,
    );
  }

  void _drawSegment(
    Canvas canvas,
    ui.PathMetric metric,
    double start,
    double segmentLength,
    Color segmentColor,
    double totalLength,
  ) {
    final pieces = <Path>[];
    final end = start + segmentLength;
    if (end <= totalLength) {
      pieces.add(metric.extractPath(start, end));
    } else {
      pieces
        ..add(metric.extractPath(start, totalLength))
        ..add(metric.extractPath(0, end - totalLength));
    }
    for (final piece in pieces) {
      canvas.drawPath(
        piece,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = 6
          ..color = segmentColor.withValues(alpha: .14)
          ..maskFilter = const ui.MaskFilter.blur(ui.BlurStyle.normal, 2.5),
      );
      canvas.drawPath(
        piece,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = 3.8
          ..color = segmentColor,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ChasingBorderPainter oldDelegate) =>
      oldDelegate.phase != phase ||
      oldDelegate.color != color ||
      oldDelegate.fast != fast;
}

class _LoginPalette {
  const _LoginPalette(this.primary, this.accent, this.background, this.owl);
  final Color primary;
  final Color accent;
  final String background;
  final String owl;

  static const blue = _LoginPalette(
    Color(0xFF1F64E8),
    Color(0xFF2FD8FF),
    'assets/images/login_themes/login_bg_blue.png',
    'assets/images/themes/owl_blue_welcome.png',
  );
  static const green = _LoginPalette(
    Color(0xFF168A55),
    Color(0xFF56EBA3),
    'assets/images/login_themes/login_bg_green.png',
    'assets/images/themes/owl_green_welcome.png',
  );
  static const red = _LoginPalette(
    Color(0xFFD34242),
    Color(0xFFFF8A78),
    'assets/images/login_themes/login_bg_red.png',
    'assets/images/themes/owl_red_welcome.png',
  );
  static const yellow = _LoginPalette(
    Color(0xFFD99000),
    Color(0xFFFFD75A),
    'assets/images/login_themes/login_bg_yellow.png',
    'assets/images/themes/owl_yellow_welcome.png',
  );
}
