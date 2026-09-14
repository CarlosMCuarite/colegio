import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/design/app_theme.dart';
import 'core/cache/school_identity_cache.dart';
import 'core/design/app_colors.dart';
import 'features/auth/presentation/auth_controller.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/home/presentation/home_screen.dart';
import 'shared/widgets/owl_companion.dart';
import 'core/update/app_update_dialog.dart';
import 'core/update/app_update_service.dart';

class SigeApp extends ConsumerStatefulWidget {
  const SigeApp({super.key});

  @override
  ConsumerState<SigeApp> createState() => _SigeAppState();
}

class _SigeAppState extends ConsumerState<SigeApp> {
  bool _minimumSplashElapsed = false;

  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 5200), () {
      if (mounted) setState(() => _minimumSplashElapsed = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final cachedColor = SchoolIdentityCache.value?['colorPrimario']?.toString();
    final schoolColor = auth.user?.school?.primaryColor ?? cachedColor;
    final primary = auth.user?.isSuperAdmin == true
        ? SigeColors.blue
        : _parseColor(schoolColor) ??
              _parseColor(cachedColor) ??
              SigeColors.blue;
    final showSplash = auth.isBootstrapping || !_minimumSplashElapsed;
    final destination = showSplash
        ? const _LaunchScreen(key: ValueKey('splash'))
        : auth.user == null
        ? const LoginScreen(key: ValueKey('login'))
        : _UpdateGate(
            key: const ValueKey('home'),
            child: HomeScreen(user: auth.user!),
          );
    return MaterialApp(
      title: 'SIGE Encinas',
      debugShowCheckedModeBanner: false,
      theme: SigeTheme.forBrand(primary: primary),
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 320),
        switchInCurve: const Cubic(0.16, 1, 0.3, 1),
        switchOutCurve: const Cubic(0.65, 0, 0.35, 1),
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween(begin: .985, end: 1.0).animate(animation),
            child: child,
          ),
        ),
        child: destination,
      ),
    );
  }

  Color? _parseColor(String? value) {
    if (value == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value)) {
      return null;
    }
    return Color(int.parse('FF${value.substring(1)}', radix: 16));
  }
}

class _UpdateGate extends StatefulWidget {
  const _UpdateGate({super.key, required this.child});
  final Widget child;
  @override
  State<_UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends State<_UpdateGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final release = await AppUpdateService().check();
        if (release != null && mounted) await showAppUpdate(context, release);
      } catch (_) {
        /* Offline: no bloquea el acceso. */
      }
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _LaunchScreen extends StatefulWidget {
  const _LaunchScreen({super.key});

  @override
  State<_LaunchScreen> createState() => _LaunchScreenState();
}

class _LaunchScreenState extends State<_LaunchScreen>
    with TickerProviderStateMixin {
  late final AnimationController _entrance;
  late final AnimationController _orbit;

  @override
  void initState() {
    super.initState();
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 760),
    )..forward();
    _orbit = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _orbit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final identity = SchoolIdentityCache.value;
    final schoolName = identity?['nombre']?.toString() ?? 'SIGE';
    final logoUrl = identity?['logoUrl']?.toString();
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    final entrance = CurvedAnimation(
      parent: _entrance,
      curve: const Cubic(0.16, 1, 0.3, 1),
    );

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(.3, -.42),
                radius: 1.35,
                colors: [
                  Color.alphaBlend(
                    scheme.primary.withValues(alpha: .16),
                    Colors.white,
                  ),
                  Color.alphaBlend(
                    scheme.primary.withValues(alpha: .045),
                    const Color(0xFFFFFCF8),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            top: -80,
            right: -90,
            child: _SplashOrb(
              size: 260,
              color: scheme.primary.withValues(alpha: .08),
            ),
          ),
          Positioned(
            bottom: -110,
            left: -95,
            child: _SplashOrb(
              size: 300,
              color: scheme.secondary.withValues(alpha: .07),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(28, 36, 28, 30),
              child: Column(
                children: [
                  FadeTransition(
                    opacity: entrance,
                    child: _SplashSchoolIdentity(
                      schoolName: schoolName,
                      logoUrl: logoUrl,
                      primary: scheme.primary,
                    ),
                  ),
                  const Spacer(),
                  AnimatedBuilder(
                    animation: Listenable.merge([_entrance, _orbit]),
                    builder: (context, child) {
                      final turn = reducedMotion ? 0.0 : _orbit.value;
                      return Opacity(
                        opacity: entrance.value,
                        child: Transform.translate(
                          offset: Offset(0, 18 * (1 - entrance.value)),
                          child: SizedBox(
                            width: 270,
                            height: 270,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Transform.rotate(
                                  angle: turn * math.pi * 2,
                                  child: CustomPaint(
                                    size: const Size.square(250),
                                    painter: _OrbitPainter(
                                      primary: scheme.primary,
                                      secondary: scheme.secondary,
                                    ),
                                  ),
                                ),
                                child!,
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                    child: const OwlCompanion(mood: OwlMood.welcome, size: 208),
                  ),
                  const SizedBox(height: 26),
                  FadeTransition(
                    opacity: entrance,
                    child: Column(
                      children: [
                        Text(
                          'Tu colegio, conectado',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(
                                color: scheme.primary,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -.5,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Preparando tu espacio institucional',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 24),
                        _AnimatedLoadRail(
                          controller: _orbit,
                          color: scheme.primary,
                          reducedMotion: reducedMotion,
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'SIGE · Gestión escolar segura',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: scheme.onSurface.withValues(alpha: .5),
                      fontWeight: FontWeight.w700,
                      letterSpacing: .3,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SplashSchoolIdentity extends StatelessWidget {
  const _SplashSchoolIdentity({
    required this.schoolName,
    required this.logoUrl,
    required this.primary,
  });
  final String schoolName;
  final String? logoUrl;
  final Color primary;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Container(
        width: 52,
        height: 52,
        padding: const EdgeInsets.all(7),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: primary.withValues(alpha: .16)),
          boxShadow: [
            BoxShadow(
              color: primary.withValues(alpha: .12),
              blurRadius: 18,
              offset: const Offset(0, 7),
            ),
          ],
        ),
        child: logoUrl == null || logoUrl!.isEmpty
            ? Image.asset('assets/images/school_logo_default.webp')
            : CachedNetworkImage(
                imageUrl: logoUrl!,
                fit: BoxFit.contain,
                placeholder: (_, _) =>
                    Image.asset('assets/images/school_logo_default.webp'),
                errorWidget: (_, _, _) =>
                    Image.asset('assets/images/school_logo_default.webp'),
              ),
      ),
      const SizedBox(width: 13),
      Flexible(
        child: Text(
          schoolName,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleLarge
              ?.copyWith(color: primary, fontWeight: FontWeight.w900),
        ),
      ),
    ],
  );
}

class _SplashOrb extends StatelessWidget {
  const _SplashOrb({required this.size, required this.color});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      border: Border.all(color: color, width: 28),
    ),
  );
}

class _AnimatedLoadRail extends StatelessWidget {
  const _AnimatedLoadRail({
    required this.controller,
    required this.color,
    required this.reducedMotion,
  });
  final Animation<double> controller;
  final Color color;
  final bool reducedMotion;

  @override
  Widget build(BuildContext context) => Container(
    width: 152,
    height: 6,
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: color.withValues(alpha: .11),
      borderRadius: BorderRadius.circular(10),
    ),
    child: reducedMotion
        ? FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: .72,
            child: ColoredBox(color: color),
          )
        : AnimatedBuilder(
            animation: controller,
            builder: (context, _) => Align(
              alignment: Alignment(-1.4 + controller.value * 2.8, 0),
              child: FractionallySizedBox(
                widthFactor: .38,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ),
  );
}

class _OrbitPainter extends CustomPainter {
  const _OrbitPainter({required this.primary, required this.secondary});
  final Color primary;
  final Color secondary;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final rect = Rect.fromCircle(center: center, radius: size.width * .46);
    final soft = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = primary.withValues(alpha: .13);
    canvas.drawCircle(center, size.width * .39, soft);
    canvas.drawArc(
      rect,
      -.2,
      1.1,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 4
        ..shader = SweepGradient(
          colors: [primary, secondary.withValues(alpha: .35)],
        ).createShader(rect),
    );
    canvas.drawCircle(
      Offset(
        center.dx + math.cos(.9) * rect.width / 2,
        center.dy + math.sin(.9) * rect.height / 2,
      ),
      5,
      Paint()..color = secondary,
    );
  }

  @override
  bool shouldRepaint(covariant _OrbitPainter oldDelegate) =>
      oldDelegate.primary != primary || oldDelegate.secondary != secondary;
}
