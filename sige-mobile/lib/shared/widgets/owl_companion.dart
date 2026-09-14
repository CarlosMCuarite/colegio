import 'package:flutter/material.dart';

enum OwlMood {
  welcome,
  thinking,
  success,
  proud,
  studying,
  empty,
  warning,
  error,
}

class OwlCompanion extends StatefulWidget {
  const OwlCompanion({
    super.key,
    required this.mood,
    this.message,
    this.size = 150,
  });

  final OwlMood mood;
  final String? message;
  final double size;

  @override
  State<OwlCompanion> createState() => _OwlCompanionState();
}

class _OwlCompanionState extends State<OwlCompanion>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _float;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _float = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final semanticMood = switch (widget.mood) {
      OwlMood.welcome => 'Búho de bienvenida',
      OwlMood.thinking => 'Búho preparando información',
      OwlMood.success => 'Búho celebrando',
      OwlMood.proud => 'Búho orgulloso por un logro',
      OwlMood.studying => 'Búho estudiando',
      OwlMood.empty => 'Búho esperando contenido',
      OwlMood.warning => 'Búho mostrando una advertencia',
      OwlMood.error => 'Búho indicando un problema',
    };
    final themedOwl = _themedOwlAsset(Theme.of(context).colorScheme.primary);
    final asset = switch (widget.mood) {
      OwlMood.welcome => themedOwl,
      OwlMood.success => themedOwl,
      OwlMood.proud => themedOwl,
      OwlMood.studying => themedOwl,
      OwlMood.thinking => themedOwl,
      OwlMood.warning => 'assets/images/sige_owl_thinking.png',
      OwlMood.empty || OwlMood.error => 'assets/images/sige_owl_concerned.png',
    };
    final image = Semantics(
      image: true,
      label: semanticMood,
      child: AnimatedSwitcher(
        duration: reduceMotion
            ? Duration.zero
            : const Duration(milliseconds: 320),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        child: Image.asset(
          asset,
          key: ValueKey(asset),
          width: widget.size,
          height: widget.size,
          fit: BoxFit.contain,
        ),
      ),
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (reduceMotion)
          image
        else
          AnimatedBuilder(
            animation: _float,
            child: image,
            builder: (context, child) => Transform.translate(
              offset: Offset(0, -4 * _float.value),
              child: child,
            ),
          ),
        if (widget.message != null) ...[
          const SizedBox(height: 8),
          Text(
            widget.message!,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ],
    );
  }

  String _themedOwlAsset(Color color) {
    final hue = HSVColor.fromColor(color).hue;
    final family = hue < 25 || hue >= 335
        ? 'red'
        : hue >= 35 && hue < 75
        ? 'yellow'
        : hue >= 75 && hue < 170
        ? 'green'
        : 'blue';
    return 'assets/images/themes/owl_${family}_welcome.png';
  }
}
