import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:image_picker/image_picker.dart';
import 'package:gal/gal.dart';

import '../../../core/config/app_config.dart';
import '../../../core/design/app_colors.dart';
import '../../auth/domain/user.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../../shared/widgets/owl_companion.dart';
import '../data/dashboard_repository.dart';
import '../domain/dashboard_data.dart';
import 'dashboard_controller.dart';
import '../../management/domain/management_module.dart';
import '../../management/presentation/management_list_screen.dart';
import '../../management/presentation/qr_attendance_screen.dart';
import '../../superadmin/presentation/superadmin_special_screen.dart';
import '../../superadmin/presentation/payment_methods_screen.dart';
import '../../superadmin/presentation/notifications_screen.dart';
import '../../superadmin/presentation/profile_settings_screens.dart';
import '../../superadmin/data/superadmin_repository.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key, required this.user});
  final SigeUser user;

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final announcements = ManagementModule(
      title: widget.user.isSuperAdmin ? 'Facturación' : 'Noticias',
      endpoint: widget.user.isSuperAdmin ? 'pagos-licencia' : 'comunicados',
      icon: widget.user.isSuperAdmin
          ? Icons.receipt_long_rounded
          : Icons.newspaper_rounded,
      color: SigeColors.blue,
      itemTitle: (item) => widget.user.isSuperAdmin
          ? nestedName(item['colegio'], 'Pago de licencia')
          : item['titulo']?.toString() ?? 'Comunicado',
      itemSubtitle: (item) => widget.user.isSuperAdmin
          ? 'S/ ${item['monto'] ?? 0} · ${item['estado'] ?? 'PENDIENTE'}'
          : item['contenido']?.toString() ?? 'Información institucional',
    );
    final documents = ManagementModule(
      title: widget.user.isSuperAdmin ? 'Colegios' : 'Documentos',
      endpoint: widget.user.isSuperAdmin ? 'colegios' : 'documentos',
      icon: widget.user.isSuperAdmin
          ? Icons.apartment_rounded
          : Icons.folder_rounded,
      color: const Color(0xFF0E8A86),
      itemTitle: (item) => widget.user.isSuperAdmin
          ? item['nombre']?.toString() ?? 'Colegio'
          : item['titulo']?.toString() ??
                item['nombre']?.toString() ??
                'Documento',
      itemSubtitle: (item) => widget.user.isSuperAdmin
          ? '${item['estado'] ?? 'Sin estado'} · ${nestedName(item['plan'], 'Sin plan')}'
          : '${item['tipo'] ?? 'Archivo'} · ${item['estado'] ?? 'DISPONIBLE'}',
    );
    return Scaffold(
      drawer: widget.user.isSuperAdmin
          ? _SuperAdminDrawer(user: widget.user)
          : _SchoolRoleDrawer(user: widget.user),
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _selectedIndex,
          children: [
            _Dashboard(user: widget.user),
            ManagementListScreen(module: announcements),
            ManagementListScreen(module: documents),
            _ProfilePage(user: widget.user),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) =>
            setState(() => _selectedIndex = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: widget.user.isSuperAdmin ? 'Control' : 'Inicio',
          ),
          NavigationDestination(
            icon: Icon(
              widget.user.isSuperAdmin
                  ? Icons.receipt_long_outlined
                  : Icons.newspaper_outlined,
            ),
            selectedIcon: Icon(
              widget.user.isSuperAdmin
                  ? Icons.receipt_long_rounded
                  : Icons.newspaper_rounded,
            ),
            label: widget.user.isSuperAdmin ? 'Facturación' : 'Noticias',
          ),
          NavigationDestination(
            icon: Icon(
              widget.user.isSuperAdmin
                  ? Icons.apartment_outlined
                  : Icons.folder_outlined,
            ),
            selectedIcon: Icon(
              widget.user.isSuperAdmin
                  ? Icons.apartment_rounded
                  : Icons.folder_rounded,
            ),
            label: widget.user.isSuperAdmin ? 'Colegios' : 'Documentos',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}

class _Dashboard extends ConsumerWidget {
  const _Dashboard({required this.user});
  final SigeUser user;

  static const courses = <_CourseData>[
    _CourseData('Arte y Cultura', Icons.palette_rounded, Color(0xFF8B5CF6)),
    _CourseData(
      'Ciencia y Tecnología',
      Icons.science_rounded,
      Color(0xFF0EA5A8),
    ),
    _CourseData('Comunicación', Icons.forum_rounded, Color(0xFFE05273)),
    _CourseData(
      'Conducta',
      Icons.volunteer_activism_rounded,
      Color(0xFF5B7CFA),
    ),
    _CourseData(
      'Educación Física',
      Icons.sports_basketball_rounded,
      Color(0xFFF17A37),
    ),
    _CourseData('Inglés', Icons.translate_rounded, Color(0xFF1678D3)),
    _CourseData('Matemática', Icons.calculate_rounded, Color(0xFF2563EB)),
    _CourseData('Música', Icons.music_note_rounded, Color(0xFFD04B9B)),
    _CourseData('Familias', Icons.family_restroom_rounded, Color(0xFF1B8D70)),
    _CourseData('Personal Social', Icons.public_rounded, Color(0xFF54738C)),
    _CourseData('Religión', Icons.auto_stories_rounded, Color(0xFFB87822)),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schoolName = user.isSuperAdmin
        ? 'Plataforma SIGE'
        : user.school?.name ?? AppConfig.schoolName;
    final dashboard = ref.watch(dashboardProvider(user));
    final academicExperience = user.role == 'PADRE' || user.role == 'DOCENTE';
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
          sliver: SliverList.list(
            children: [
              _TopBar(schoolName: schoolName, user: user),
              const SizedBox(height: 20),
              _WelcomeBanner(user: user),
              const SizedBox(height: 28),
              dashboard.when(
                data: (data) => _LiveOverview(data: data),
                loading: () => const _DashboardSkeleton(),
                error: (error, _) => _DashboardError(
                  message: error is DashboardException
                      ? error.message
                      : 'No pudimos actualizar el panel.',
                  onRetry: () => ref.invalidate(dashboardProvider(user)),
                ),
              ),
              const SizedBox(height: 28),
              _SectionTitle(
                title: user.isSuperAdmin
                    ? 'Centro de control'
                    : academicExperience
                    ? 'Tus cursos'
                    : 'Gestión principal',
              ),
              const SizedBox(height: 14),
              academicExperience
                  ? SizedBox(
                      height: 196,
                      child: ListView.separated(
                        clipBehavior: Clip.none,
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.only(right: 22),
                        itemCount: courses.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 14),
                        itemBuilder: (context, index) =>
                            _CourseCard(course: courses[index]),
                      ),
                    )
                  : _RoleActions(role: user.role),
              const SizedBox(height: 28),
              if (!user.isSuperAdmin) ...[
                const _SectionTitle(title: 'Hoy en SIGE'),
                const SizedBox(height: 14),
                _QuickActions(role: user.role),
                const SizedBox(height: 26),
                const _NextActivity(),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _LiveOverview extends StatelessWidget {
  const _LiveOverview({required this.data});
  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final metrics = switch (data.kind) {
      DashboardKind.superAdmin => [
        (
          'Colegios',
          data.kpis['totalColegios'],
          Icons.apartment_rounded,
          SigeColors.blue,
          '${data.kpis['colegiosActivos'] ?? 0} activos · ${data.kpis['colegiosEnPrueba'] ?? 0} en prueba',
        ),
        (
          'Usuarios activos',
          data.kpis['totalUsuarios'],
          Icons.manage_accounts_rounded,
          const Color(0xFF6F52B5),
          '${data.kpis['totalEstudiantes'] ?? 0} estudiantes · ${data.kpis['totalPadres'] ?? 0} padres',
        ),
        (
          'Licencias activas',
          data.kpis['licenciasActivas'],
          Icons.verified_rounded,
          const Color(0xFF168A55),
          '${data.kpis['licenciasPorVencer'] ?? 0} por vencer · ${data.kpis['licenciasVencidas'] ?? 0} vencidas',
        ),
        (
          'Ingresos históricos',
          'S/ ${data.kpis['ingresosSuscripcion'] ?? 0}',
          Icons.payments_rounded,
          const Color(0xFF0E8A86),
          'Suscripciones aprobadas',
        ),
        (
          'Ingreso mensual',
          'S/ ${data.kpis['mrr'] ?? 0}',
          Icons.trending_up_rounded,
          const Color(0xFFB75A45),
          'MRR estimado de la plataforma',
        ),
      ],
      DashboardKind.executive => [
        (
          'Estudiantes',
          data.kpis['totalEstudiantes'],
          Icons.groups_rounded,
          SigeColors.blue,
          'Registrados en el colegio',
        ),
        (
          'Docentes',
          data.kpis['totalDocentes'],
          Icons.school_rounded,
          const Color(0xFF0E8A86),
          'Personal docente',
        ),
        (
          'Matrículas',
          data.kpis['matriculasAno'],
          Icons.badge_rounded,
          const Color(0xFF6F52B5),
          'Durante el año actual',
        ),
        (
          'Pendientes',
          data.kpis['documentosPendientes'],
          Icons.pending_actions_rounded,
          const Color(0xFFB87822),
          'Documentos por revisar',
        ),
      ],
      DashboardKind.family => [
        (
          'Hijos',
          data.students.length,
          Icons.family_restroom_rounded,
          SigeColors.blue,
          'Vinculados a tu cuenta',
        ),
        (
          'Mensajes',
          data.unreadNotifications,
          Icons.notifications_active_rounded,
          const Color(0xFF6F52B5),
          'Notificaciones sin leer',
        ),
        (
          'Deuda',
          'S/ ${data.totalDebt.toStringAsFixed(0)}',
          Icons.account_balance_wallet_rounded,
          const Color(0xFFB75A45),
          'Saldo escolar pendiente',
        ),
        (
          'Eventos',
          data.events.length,
          Icons.event_rounded,
          const Color(0xFF0E8A86),
          'Próximas actividades',
        ),
      ],
      DashboardKind.staff => const [],
    };
    if (metrics.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Resumen en vivo',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            const Icon(
              Icons.cloud_done_rounded,
              color: Color(0xFF168A55),
              size: 20,
            ),
            const SizedBox(width: 6),
            Text('Render', style: Theme.of(context).textTheme.labelMedium),
          ],
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 154,
          child: ListView.separated(
            clipBehavior: Clip.none,
            scrollDirection: Axis.horizontal,
            itemCount: metrics.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final metric = metrics[index];
              return TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: Duration(milliseconds: 360 + (index * 55)),
                curve: Curves.easeOutCubic,
                builder: (context, value, child) => Opacity(
                  opacity: value,
                  child: Transform.translate(
                    offset: Offset(18 * (1 - value), 0),
                    child: child,
                  ),
                ),
                child: Container(
                  width: 210,
                  padding: const EdgeInsets.all(17),
                  decoration: BoxDecoration(
                    color: metric.$4.withValues(alpha: .09),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: metric.$4,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              metric.$3,
                              color: Colors.white,
                              size: 21,
                            ),
                          ),
                          const Spacer(),
                          const Icon(Icons.north_east_rounded, size: 18),
                        ],
                      ),
                      const Spacer(),
                      Text(
                        '${metric.$2 ?? 0}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      Text(
                        metric.$1,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        metric.$5,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        if (data.kind == DashboardKind.superAdmin) ...[
          const SizedBox(height: 18),
          _SuperAdminAlerts(alerts: data.alerts),
          const SizedBox(height: 22),
          _SuperAdminCharts(data: data),
        ],
      ],
    );
  }
}

class _SuperAdminAlerts extends StatelessWidget {
  const _SuperAdminAlerts({required this.alerts});
  final Map<String, dynamic> alerts;

  @override
  Widget build(BuildContext context) {
    final expiring = alerts['colegiosPorVencer'];
    final expired = alerts['colegiosVencidos'];
    final payments = alerts['pagosPendientesRevision'];
    final backups = alerts['backupsFallidos24h'];
    final items = [
      (
        'Licencias por vencer',
        expiring is List ? expiring.length : 0,
        Icons.event_busy_rounded,
        const Color(0xFF9A5B00),
      ),
      (
        'Licencias vencidas',
        expired is List ? expired.length : 0,
        Icons.block_rounded,
        const Color(0xFFB42318),
      ),
      (
        'Pagos en revisión',
        payments is num ? payments.toInt() : 0,
        Icons.receipt_long_rounded,
        const Color(0xFF3756B8),
      ),
      (
        'Backups fallidos',
        backups is num ? backups.toInt() : 0,
        Icons.cloud_off_rounded,
        const Color(0xFFB42318),
      ),
    ];
    final total = items.fold<int>(0, (sum, item) => sum + item.$2);
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: total > 0 ? const Color(0xFFFFF5E8) : const Color(0xFFEAF8F1),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                total > 0
                    ? Icons.notifications_active_rounded
                    : Icons.verified_rounded,
                color: total > 0
                    ? const Color(0xFF9A5B00)
                    : const Color(0xFF168A55),
              ),
              const SizedBox(width: 9),
              Text(
                total > 0
                    ? 'Centro de alertas · $total'
                    : 'Todo funciona correctamente',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
          if (total > 0) ...[
            const SizedBox(height: 12),
            for (final item in items.where((item) => item.$2 > 0))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Icon(item.$3, size: 19, color: item.$4),
                    const SizedBox(width: 9),
                    Expanded(child: Text(item.$1)),
                    Text(
                      '${item.$2}',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _SuperAdminCharts extends StatelessWidget {
  const _SuperAdminCharts({required this.data});
  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final schoolValues = data.schoolsByStatus
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => (
            item['estado']?.toString() ?? 'OTRO',
            (item['_count'] as num?)?.toDouble() ?? 0,
          ),
        )
        .toList();
    final revenue = data.revenueByMonth
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => (
            item['mes']?.toString() ?? '',
            (item['total'] as num?)?.toDouble() ?? 0,
          ),
        )
        .toList();
    if (schoolValues.isEmpty && revenue.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Indicadores de plataforma',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 5),
        const Text('Gráficos construidos con información real de SIGE.'),
        const SizedBox(height: 14),
        if (schoolValues.isNotEmpty)
          _ChartSurface(
            title: 'Colegios por estado',
            icon: Icons.domain_verification_rounded,
            child: BarChart(
              BarChartData(
                maxY:
                    schoolValues
                        .map((item) => item.$2)
                        .fold<double>(0, (a, b) => a > b ? a : b) +
                    1,
                alignment: BarChartAlignment.spaceAround,
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipItem: (group, groupIndex, rod, rodIndex) =>
                        BarTooltipItem(
                          '${schoolValues[group.x].$1}\n${rod.toY.toInt()} colegios',
                          const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= schoolValues.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            schoolValues[index].$1.substring(
                              0,
                              schoolValues[index].$1.length.clamp(0, 5),
                            ),
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                barGroups: [
                  for (var index = 0; index < schoolValues.length; index++)
                    BarChartGroupData(
                      x: index,
                      barRods: [
                        BarChartRodData(
                          toY: schoolValues[index].$2,
                          width: 22,
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(7),
                          ),
                          color: _statusColor(schoolValues[index].$1),
                        ),
                      ],
                    ),
                ],
              ),
              duration: const Duration(milliseconds: 520),
              curve: Curves.easeOutCubic,
            ),
          ),
        if (schoolValues.isNotEmpty && revenue.isNotEmpty)
          const SizedBox(height: 14),
        if (revenue.isNotEmpty)
          _ChartSurface(
            title: 'Ingresos por suscripción',
            icon: Icons.stacked_line_chart_rounded,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) =>
                      const FlLine(color: Color(0xFFE5EDF6), strokeWidth: 1),
                ),
                borderData: FlBorderData(show: false),
                titlesData: const FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  topTitles: AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipItems: (spots) => spots
                        .map(
                          (spot) => LineTooltipItem(
                            '${revenue[spot.x.toInt()].$1}\nS/ ${spot.y.toStringAsFixed(0)}',
                            const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: [
                      for (var index = 0; index < revenue.length; index++)
                        FlSpot(index.toDouble(), revenue[index].$2),
                    ],
                    isCurved: true,
                    curveSmoothness: .35,
                    color: const Color(0xFF0E8A86),
                    barWidth: 4,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          const Color(0xFF0E8A86).withValues(alpha: .24),
                          const Color(0xFF0E8A86).withValues(alpha: 0),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              duration: const Duration(milliseconds: 620),
              curve: Curves.easeOutCubic,
            ),
          ),
      ],
    );
  }

  static Color _statusColor(String status) => switch (status) {
    'ACTIVO' => const Color(0xFF168A55),
    'SUSPENDIDO' => SigeColors.danger,
    'PRUEBA' => const Color(0xFFB87822),
    _ => SigeColors.slate,
  };
}

class _ChartSurface extends StatelessWidget {
  const _ChartSurface({
    required this.title,
    required this.icon,
    required this.child,
  });
  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    height: 238,
    padding: const EdgeInsets.fromLTRB(18, 17, 18, 16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0D173B66),
          offset: Offset(0, 8),
          blurRadius: 24,
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 20, color: SigeColors.blue),
            const SizedBox(width: 8),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
        const SizedBox(height: 14),
        Expanded(child: child),
      ],
    ),
  );
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();
  @override
  Widget build(BuildContext context) => Container(
    height: 116,
    decoration: BoxDecoration(
      color: const Color(0xFFEAF2FC),
      borderRadius: BorderRadius.circular(22),
    ),
    alignment: Alignment.center,
    child: const CircularProgressIndicator.adaptive(),
  );
}

class _DashboardError extends StatelessWidget {
  const _DashboardError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF4E5),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      children: [
        const OwlCompanion(mood: OwlMood.error, size: 92),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 10),
        FilledButton.tonalIcon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Reintentar conexión'),
        ),
      ],
    ),
  );
}

class _RoleActions extends StatelessWidget {
  const _RoleActions({required this.role});
  final String role;

  @override
  Widget build(BuildContext context) {
    final actions = role == 'SUPERADMIN'
        ? [
            ManagementModule(
              title: 'Colegios',
              endpoint: 'colegios',
              icon: Icons.apartment_rounded,
              color: const Color(0xFF2563EB),
              itemTitle: (item) => item['nombre']?.toString() ?? 'Colegio',
              itemSubtitle: (item) =>
                  '${item['estado'] ?? 'Sin estado'} · ${nestedName(item['plan'], 'Sin plan')}',
            ),
            ManagementModule(
              title: 'Membresías',
              endpoint: 'membresias/planes',
              icon: Icons.workspace_premium_rounded,
              color: const Color(0xFFB87822),
              searchable: false,
              itemTitle: (item) => item['nombre']?.toString() ?? 'Plan',
              itemSubtitle: (item) =>
                  'S/ ${item['precio'] ?? 0} · ${item['duracionDias'] ?? 0} días',
            ),
            ManagementModule(
              title: 'Licencias',
              endpoint: 'colegios',
              icon: Icons.verified_user_rounded,
              color: const Color(0xFF0E8A86),
              itemTitle: (item) => item['nombre']?.toString() ?? 'Colegio',
              itemSubtitle: (item) =>
                  '${item['estado'] ?? 'INACTIVO'} · vence ${item['licenciaFin']?.toString().split('T').first ?? 'sin fecha'}',
            ),
            ManagementModule(
              title: 'Facturación',
              endpoint: 'pagos-licencia',
              icon: Icons.receipt_long_rounded,
              color: const Color(0xFFB75A45),
              searchable: false,
              itemTitle: (item) =>
                  nestedName(item['colegio'], 'Pago de licencia'),
              itemSubtitle: (item) =>
                  'S/ ${item['monto'] ?? 0} · ${item['estado'] ?? 'PENDIENTE'}',
            ),
            ManagementModule(
              title: 'Usuarios',
              endpoint: 'usuarios',
              icon: Icons.manage_accounts_rounded,
              color: const Color(0xFF6F52B5),
              itemTitle: joinedName,
              itemSubtitle: (item) =>
                  '${item['rol'] ?? 'Usuario'} · ${nestedName(item['colegio'], 'Plataforma')}',
            ),
            ManagementModule(
              title: 'Roles por plan',
              endpoint: 'membresias/planes',
              icon: Icons.admin_panel_settings_rounded,
              color: const Color(0xFF3756B8),
              searchable: false,
              itemTitle: (item) => item['nombre']?.toString() ?? 'Plan',
              itemSubtitle: (item) {
                final roles = item['rolesHabilitados'];
                return roles is List
                    ? '${roles.length} roles habilitados'
                    : 'Configurar roles disponibles';
              },
            ),
            ManagementModule(
              title: 'Monitoreo',
              endpoint: 'dashboard/monitoreo',
              icon: Icons.monitor_heart_rounded,
              color: const Color(0xFF168A55),
              searchable: false,
              itemTitle: (_) => 'Estado del sistema',
              itemSubtitle: (_) => 'Servidor, base de datos y respaldos',
            ),
            ManagementModule(
              title: 'Respaldos',
              endpoint: 'backups',
              icon: Icons.cloud_sync_rounded,
              color: const Color(0xFF54738C),
              searchable: false,
              itemTitle: (item) =>
                  item['nombre']?.toString() ??
                  nestedName(item['colegio'], 'Respaldo global'),
              itemSubtitle: _backupSubtitle,
            ),
            ManagementModule(
              title: 'Auditoría',
              endpoint: 'auditoria/global',
              icon: Icons.fact_check_rounded,
              color: const Color(0xFF6F52B5),
              itemTitle: (item) => item['accion']?.toString() ?? 'Actividad',
              itemSubtitle: (item) =>
                  '${item['modulo'] ?? 'SIGE'} · ${nestedName(item['colegio'], 'Global')}',
            ),
            ManagementModule(
              title: 'Datos de cobro',
              endpoint: 'plataforma/config',
              icon: Icons.tune_rounded,
              color: const Color(0xFF9A5B00),
              searchable: false,
              itemTitle: (_) => 'Configuración global',
              itemSubtitle: (_) => 'Cobros, contacto, identidad y preferencias',
            ),
          ]
        : role == 'ADMINISTRADOR'
        ? [
            ManagementModule(
              title: 'Estudiantes',
              endpoint: 'estudiantes',
              icon: Icons.groups_rounded,
              color: const Color(0xFF2563EB),
              itemTitle: joinedName,
              itemSubtitle: (item) {
                final enrollments = item['matriculas'];
                final enrollment = enrollments is List && enrollments.isNotEmpty
                    ? enrollments.first
                    : null;
                if (enrollment is Map<String, dynamic>) {
                  return '${nestedName(enrollment['nivelGrado'])} · ${nestedName(enrollment['seccion'], 'Sin sección')}';
                }
                return '${item['dni'] ?? 'Sin DNI'} · Sin matrícula activa';
              },
            ),
            ManagementModule(
              title: 'Matrículas',
              endpoint: 'matriculas',
              icon: Icons.badge_rounded,
              color: const Color(0xFF0E8A86),
              searchable: false,
              itemTitle: (item) => item['estudiante'] is Map<String, dynamic>
                  ? joinedName(item['estudiante'] as Map<String, dynamic>)
                  : 'Matrícula',
              itemSubtitle: (item) =>
                  '${nestedName(item['nivelGrado'])} · ${item['anoEscolar'] ?? ''}',
            ),
            ManagementModule(
              title: 'Asistencia',
              endpoint: 'asistencia',
              icon: Icons.fact_check_rounded,
              color: const Color(0xFF168A55),
              searchable: false,
              itemTitle: (item) => item['estudiante'] is Map<String, dynamic>
                  ? joinedName(item['estudiante'] as Map<String, dynamic>)
                  : 'Registro de asistencia',
              itemSubtitle: (item) =>
                  '${item['estado'] ?? 'SIN ESTADO'} · ${item['fecha']?.toString().split('T').first ?? ''}',
            ),
            ManagementModule(
              title: 'Padres',
              endpoint: 'padres',
              icon: Icons.family_restroom_rounded,
              color: const Color(0xFF3756B8),
              itemTitle: joinedName,
              itemSubtitle: (item) =>
                  '${item['dni'] ?? 'Sin DNI'} · ${item['telefono'] ?? 'Sin teléfono'}',
            ),
            ManagementModule(
              title: 'Personal',
              endpoint: 'usuarios',
              icon: Icons.manage_accounts_rounded,
              color: const Color(0xFF6F52B5),
              itemTitle: joinedName,
              itemSubtitle: (item) =>
                  '${item['rol'] ?? 'Usuario'} · ${item['email'] ?? ''}',
            ),
            ManagementModule(
              title: 'Permisos de salida',
              endpoint: 'permisos',
              icon: Icons.door_front_door_outlined,
              color: const Color(0xFFB75A45),
              searchable: false,
              itemTitle: (item) => item['estudiante'] is Map<String, dynamic>
                  ? joinedName(item['estudiante'] as Map<String, dynamic>)
                  : 'Permiso de salida',
              itemSubtitle: (item) =>
                  '${item['estado'] ?? 'SOLICITADO'} · ${item['motivo'] ?? ''}',
            ),
            ManagementModule(
              title: 'Aulas',
              endpoint: 'aulas',
              icon: Icons.meeting_room_rounded,
              color: const Color(0xFF54738C),
              itemTitle: (item) => item['nombre']?.toString() ?? 'Aula',
              itemSubtitle: (item) =>
                  '${nestedName(item['nivelGrado'])} · ${nestedName(item['seccion'], 'Sin sección')}',
            ),
            ManagementModule(
              title: 'Secciones',
              endpoint: 'aulas/secciones',
              icon: Icons.account_tree_rounded,
              color: const Color(0xFF6F52B5),
              itemTitle: (item) => item['nombre']?.toString() ?? 'Sección',
              itemSubtitle: (item) =>
                  item['descripcion']?.toString() ?? 'Organización académica',
            ),
            ManagementModule(
              title: 'Horarios',
              endpoint: 'horarios',
              icon: Icons.calendar_view_week_rounded,
              color: const Color(0xFF0E8A86),
              searchable: false,
              itemTitle: (item) =>
                  nestedName(item['curso'], 'Bloque académico'),
              itemSubtitle: (item) =>
                  '${item['diaSemana'] ?? ''} · ${item['horaInicio'] ?? ''} - ${item['horaFin'] ?? ''}',
            ),
            ManagementModule(
              title: 'Cursos',
              endpoint: 'cursos',
              icon: Icons.menu_book_rounded,
              color: const Color(0xFF2563EB),
              itemTitle: (item) => item['nombre']?.toString() ?? 'Curso',
              itemSubtitle: (item) =>
                  item['descripcion']?.toString() ?? 'Plan académico',
            ),
            ManagementModule(
              title: 'Tesorería',
              endpoint: 'pagos',
              icon: Icons.payments_rounded,
              color: const Color(0xFFB87822),
              searchable: false,
              itemTitle: (item) => nestedName(item['concepto'], 'Pago escolar'),
              itemSubtitle: (item) =>
                  'S/ ${item['monto'] ?? 0} · ${item['estado'] ?? 'PENDIENTE'}',
            ),
            ManagementModule(
              title: 'Comunicados',
              endpoint: 'comunicados',
              icon: Icons.campaign_rounded,
              color: const Color(0xFF914360),
              itemTitle: (item) => item['titulo']?.toString() ?? 'Comunicado',
              itemSubtitle: (item) => item['contenido']?.toString() ?? '',
            ),
            ManagementModule(
              title: 'Eventos',
              endpoint: 'eventos',
              icon: Icons.event_rounded,
              color: const Color(0xFFB87822),
              itemTitle: (item) => item['titulo']?.toString() ?? 'Evento',
              itemSubtitle: (item) =>
                  '${item['fechaInicio']?.toString().split('T').first ?? ''} · ${item['lugar'] ?? ''}',
            ),
            ManagementModule(
              title: 'Exportaciones',
              endpoint: 'exportaciones',
              icon: Icons.download_rounded,
              color: const Color(0xFF54738C),
              searchable: false,
              itemTitle: (item) => item['tipo']?.toString() ?? 'Exportación',
              itemSubtitle: (item) =>
                  '${item['estado'] ?? ''} · ${item['createdAt']?.toString().split('T').first ?? ''}',
            ),
            ManagementModule(
              title: 'Suscripción',
              endpoint: 'membresias/mi-plan',
              icon: Icons.workspace_premium_rounded,
              color: const Color(0xFF9A5B00),
              searchable: false,
              itemTitle: (item) => nestedName(item['plan'], 'Plan del colegio'),
              itemSubtitle: (item) =>
                  '${item['diasRestantes'] ?? '—'} días restantes',
            ),
            ManagementModule(
              title: 'Auditoría',
              endpoint: 'auditoria',
              icon: Icons.shield_outlined,
              color: const Color(0xFF6F52B5),
              itemTitle: (item) => item['accion']?.toString() ?? 'Actividad',
              itemSubtitle: (item) =>
                  '${item['modulo'] ?? 'SIGE'} · ${item['descripcion'] ?? ''}',
            ),
            ManagementModule(
              title: 'Configuración',
              endpoint: 'colegios',
              icon: Icons.tune_rounded,
              color: const Color(0xFF3756B8),
              searchable: false,
              itemTitle: (item) => item['nombre']?.toString() ?? 'Mi colegio',
              itemSubtitle: (_) => 'Identidad, pagos, carnet y preferencias',
            ),
          ]
        : [
            ManagementModule(
              title: 'Estudiantes',
              endpoint: 'estudiantes',
              icon: Icons.groups_rounded,
              color: const Color(0xFF2563EB),
              itemTitle: joinedName,
              itemSubtitle: (item) => item['dni']?.toString() ?? 'Sin DNI',
            ),
            ManagementModule(
              title: 'Tesorería',
              endpoint: 'pagos',
              icon: Icons.payments_rounded,
              color: const Color(0xFFB87822),
              itemTitle: (item) => nestedName(item['concepto'], 'Pago escolar'),
              itemSubtitle: (item) =>
                  'S/ ${item['monto'] ?? 0} · ${item['estado'] ?? 'PENDIENTE'}',
            ),
          ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: actions.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisExtent: 126,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemBuilder: (context, index) {
        final action = actions[index];
        final actionColor = role == 'SUPERADMIN'
            ? action.color
            : Theme.of(context).colorScheme.primary;
        return InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => switch (action.title) {
                'Monitoreo' => const SuperAdminMonitorScreen(),
                'Datos de cobro' => const PaymentMethodsScreen(),
                _ => ManagementListScreen(module: action),
              },
            ),
          ),
          child: Ink(
            padding: const EdgeInsets.all(17),
            decoration: BoxDecoration(
              color: actionColor.withValues(alpha: .10),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(action.icon, color: actionColor, size: 30),
                const Spacer(),
                Text(
                  action.title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  role == 'SUPERADMIN'
                      ? 'Gestionar plataforma'
                      : 'Abrir gestión',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _TopBar extends ConsumerWidget {
  const _TopBar({required this.schoolName, required this.user});
  final String schoolName;
  final SigeUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider(user)).valueOrNull;
    final notifications = ref.watch(notificationsProvider).valueOrNull;
    final alertCount = notifications == null
        ? (user.isSuperAdmin ? 0 : dashboard?.unreadNotifications ?? 0)
        : notifications.where((item) => item['leida'] != true).length;
    return Row(
      children: [
        Builder(
          builder: (context) => IconButton.filledTonal(
            tooltip: 'Abrir menú principal',
            onPressed: () => Scaffold.of(context).openDrawer(),
            icon: const Icon(Icons.menu_rounded),
          ),
        ),
        const SizedBox(width: 10),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SIGE',
                style: Theme.of(context).textTheme.labelLarge
                    ?.copyWith(color: Theme.of(context).colorScheme.primary),
              ),
              Text(
                schoolName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
        ),
        IconButton.filledTonal(
          tooltip: alertCount > 0
              ? '$alertCount alertas pendientes'
              : 'Centro de notificaciones',
          onPressed: () => Navigator.of(context).push<void>(
            MaterialPageRoute(builder: (_) => const NotificationsScreen()),
          ),
          icon: Badge(
            isLabelVisible: alertCount > 0,
            label: Text(alertCount > 99 ? '99+' : '$alertCount'),
            child: const Icon(Icons.notifications_none_rounded),
          ),
        ),
      ],
    );
  }
}

int _dashboardAlertCount(DashboardData data) {
  if (data.kind != DashboardKind.superAdmin) return data.unreadNotifications;
  final expiring = data.alerts['colegiosPorVencer'];
  final expired = data.alerts['colegiosVencidos'];
  return (expiring is List ? expiring.length : 0) +
      (expired is List ? expired.length : 0) +
      ((data.alerts['pagosPendientesRevision'] as num?)?.toInt() ?? 0) +
      ((data.alerts['backupsFallidos24h'] as num?)?.toInt() ?? 0);
}

Future<void> _showNotificationCenter(
  BuildContext context,
  DashboardData data,
) => showModalBottomSheet<void>(
  context: context,
  showDragHandle: true,
  isScrollControlled: true,
  builder: (context) {
    final entries = <(String, int, IconData, Color)>[
      (
        'Licencias próximas a vencer',
        data.alerts['colegiosPorVencer'] is List
            ? (data.alerts['colegiosPorVencer'] as List).length
            : 0,
        Icons.event_busy_rounded,
        const Color(0xFFC07800),
      ),
      (
        'Licencias vencidas',
        data.alerts['colegiosVencidos'] is List
            ? (data.alerts['colegiosVencidos'] as List).length
            : 0,
        Icons.gpp_bad_rounded,
        SigeColors.danger,
      ),
      (
        'Pagos esperando revisión',
        (data.alerts['pagosPendientesRevision'] as num?)?.toInt() ?? 0,
        Icons.receipt_long_rounded,
        SigeColors.blue,
      ),
      (
        'Respaldos fallidos en 24 h',
        (data.alerts['backupsFallidos24h'] as num?)?.toInt() ?? 0,
        Icons.cloud_off_rounded,
        const Color(0xFF7A4FB5),
      ),
    ];
    final active = entries.where((entry) => entry.$2 > 0).toList();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Centro de alertas',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 6),
            const Text('Información sincronizada con SIGE en este momento.'),
            const SizedBox(height: 18),
            if (active.isEmpty)
              const OwlCompanion(
                mood: OwlMood.success,
                size: 126,
                message: 'Todo está al día. No tienes alertas pendientes.',
              )
            else
              for (final entry in active)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: entry.$4.withValues(alpha: .12),
                    foregroundColor: entry.$4,
                    child: Icon(entry.$3),
                  ),
                  title: Text(entry.$1),
                  trailing: Badge(label: Text('${entry.$2}')),
                ),
          ],
        ),
      ),
    );
  },
);

class _SuperAdminDrawer extends StatelessWidget {
  const _SuperAdminDrawer({required this.user});
  final SigeUser user;

  @override
  Widget build(BuildContext context) {
    final modules = <(String, ManagementModule)>[
      (
        'Colegios',
        ManagementModule(
          title: 'Colegios',
          endpoint: 'colegios',
          icon: Icons.apartment_rounded,
          color: SigeColors.blue,
          itemTitle: (item) => item['nombre']?.toString() ?? 'Colegio',
          itemSubtitle: (item) =>
              '${item['estado'] ?? 'Sin estado'} · ${nestedName(item['plan'], 'Sin plan')}',
        ),
      ),
      (
        'Planes',
        ManagementModule(
          title: 'Membresías',
          endpoint: 'membresias/planes',
          icon: Icons.workspace_premium_rounded,
          color: const Color(0xFFB87822),
          searchable: false,
          itemTitle: (item) => item['nombre']?.toString() ?? 'Plan',
          itemSubtitle: (item) =>
              'S/ ${item['precio'] ?? 0} · ${item['maxEstudiantes'] ?? 0} estudiantes',
        ),
      ),
      (
        'Usuarios',
        ManagementModule(
          title: 'Usuarios',
          endpoint: 'usuarios',
          icon: Icons.manage_accounts_rounded,
          color: const Color(0xFF6F52B5),
          itemTitle: joinedName,
          itemSubtitle: (item) =>
              '${item['rol'] ?? 'Usuario'} · ${nestedName(item['colegio'], 'Plataforma')}',
        ),
      ),
      (
        'Facturación',
        ManagementModule(
          title: 'Facturación',
          endpoint: 'pagos-licencia',
          icon: Icons.receipt_long_rounded,
          color: const Color(0xFFB75A45),
          searchable: false,
          itemTitle: (item) => nestedName(item['colegio'], 'Pago'),
          itemSubtitle: (item) =>
              'S/ ${item['monto'] ?? 0} · ${item['estado'] ?? 'PENDIENTE'}',
        ),
      ),
      (
        'Licencias',
        ManagementModule(
          title: 'Licencias',
          endpoint: 'colegios',
          icon: Icons.verified_user_rounded,
          color: const Color(0xFF0E8A86),
          itemTitle: (item) => item['nombre']?.toString() ?? 'Colegio',
          itemSubtitle: (item) =>
              '${item['estado'] ?? 'INACTIVO'} · vence ${item['licenciaFin']?.toString().split('T').first ?? 'sin fecha'}',
        ),
      ),
      (
        'Respaldos',
        ManagementModule(
          title: 'Respaldos',
          endpoint: 'backups',
          icon: Icons.cloud_sync_rounded,
          color: const Color(0xFF54738C),
          searchable: false,
          itemTitle: (item) => item['nombre']?.toString() ?? 'Respaldo',
          itemSubtitle: _backupSubtitle,
        ),
      ),
      (
        'Auditoría',
        ManagementModule(
          title: 'Auditoría',
          endpoint: 'auditoria/global',
          icon: Icons.fact_check_rounded,
          color: const Color(0xFF6F52B5),
          itemTitle: (item) => item['accion']?.toString() ?? 'Actividad',
          itemSubtitle: (item) =>
              '${item['modulo'] ?? 'SIGE'} · ${nestedName(item['colegio'], 'Global')}',
        ),
      ),
    ];
    return NavigationDrawer(
      backgroundColor: const Color(0xFFF7FAFF),
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(12, 18, 12, 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF102C63), Color(0xFF2563EB)],
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            children: [
              _ProfileAvatar(user: user, size: 50),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Text(
                      'Control global de SIGE',
                      style: TextStyle(color: Color(0xFFD8E8FF)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(24, 16, 20, 6),
          child: Text(
            'PLATAFORMA',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.1,
              color: SigeColors.slate,
            ),
          ),
        ),
        for (final entry in modules) ...[
          if (entry.$1 == 'Usuarios')
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 18, 20, 6),
              child: Text(
                'OPERACIÓN',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.1,
                  color: SigeColors.slate,
                ),
              ),
            ),
          if (entry.$1 == 'Respaldos')
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 18, 20, 6),
              child: Text(
                'SEGURIDAD Y SISTEMA',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.1,
                  color: SigeColors.slate,
                ),
              ),
            ),
          ListTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: entry.$2.color.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(entry.$2.icon, color: entry.$2.color, size: 21),
            ),
            title: Text(
              entry.$1,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () {
              Navigator.pop(context);
              Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (_) => ManagementListScreen(module: entry.$2),
                ),
              );
            },
          ),
        ],
        ListTile(
          leading: const Icon(
            Icons.monitor_heart_rounded,
            color: Color(0xFF168A55),
          ),
          title: const Text('Monitoreo en vivo'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () {
            Navigator.pop(context);
            Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => const SuperAdminMonitorScreen(),
              ),
            );
          },
        ),
        ListTile(
          leading: const Icon(Icons.tune_rounded, color: Color(0xFF9A5B00)),
          title: const Text('Datos de cobro'),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () {
            Navigator.pop(context);
            Navigator.of(context).push<void>(
              MaterialPageRoute(builder: (_) => const PaymentMethodsScreen()),
            );
          },
        ),
      ],
    );
  }
}

class _SchoolRoleDrawer extends StatelessWidget {
  const _SchoolRoleDrawer({required this.user});
  final SigeUser user;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final modules = _modulesForSchoolRole(user.role, scheme.primary);
    final school = user.school;
    return NavigationDrawer(
      backgroundColor: Color.alphaBlend(
        scheme.primary.withValues(alpha: .035),
        Colors.white,
      ),
      children: [
        Container(
          margin: const EdgeInsets.fromLTRB(12, 18, 12, 10),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [scheme.primary, scheme.secondary],
            ),
            borderRadius: BorderRadius.circular(26),
            boxShadow: [
              BoxShadow(
                color: scheme.primary.withValues(alpha: .22),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              _ProfileAvatar(user: user, size: 52),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      school?.name ?? 'Mi colegio',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _schoolRoleLabel(user.role),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .82),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 14, 20, 6),
          child: Text(
            'GESTIÓN ${_schoolRoleLabel(user.role).toUpperCase()}',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.15,
              color: scheme.primary,
            ),
          ),
        ),
        for (final module in modules)
          ListTile(
            minTileHeight: 54,
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(module.icon, color: scheme.primary, size: 21),
            ),
            title: Text(
              module.title,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            trailing: const Icon(Icons.chevron_right_rounded, size: 20),
            onTap: () {
              Navigator.pop(context);
              Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (_) => module.title == 'QR Asistencia'
                      ? const QrAttendanceScreen()
                      : ManagementListScreen(module: module),
                ),
              );
            },
          ),
        const SizedBox(height: 18),
      ],
    );
  }
}

List<ManagementModule> _modulesForSchoolRole(String role, Color primary) {
  ManagementModule module(
    String title,
    String endpoint,
    IconData icon, {
    bool searchable = true,
  }) => ManagementModule(
    title: title,
    endpoint: endpoint,
    icon: icon,
    color: primary,
    searchable: searchable,
    itemTitle: (item) =>
        item['titulo']?.toString() ??
        item['nombre']?.toString() ??
        (item['estudiante'] is Map<String, dynamic>
            ? joinedName(item['estudiante'] as Map<String, dynamic>)
            : title),
    itemSubtitle: (item) =>
        item['descripcion']?.toString() ??
        item['contenido']?.toString() ??
        item['estado']?.toString() ??
        'Abrir detalle',
  );

  final common = <ManagementModule>[
    module('Estudiantes', 'estudiantes', Icons.groups_rounded),
    module('Matrículas', 'matriculas', Icons.badge_rounded),
    module(
      'Horarios',
      'horarios',
      Icons.calendar_view_week_rounded,
      searchable: false,
    ),
    module('Cursos', 'cursos', Icons.menu_book_rounded),
    module('Pagos', 'pagos', Icons.payments_rounded),
    module('Comunicados', 'comunicados', Icons.campaign_rounded),
    module('Eventos', 'eventos', Icons.event_rounded),
    module('Documentos', 'documentos', Icons.folder_rounded),
    module('Permisos de salida', 'permisos', Icons.door_front_door_rounded),
  ];
  if (role == 'SECRETARIA') {
    return [
      module(
        'QR Asistencia',
        'qr/escanear',
        Icons.qr_code_scanner_rounded,
        searchable: false,
      ),
      module(
        'Asistencia',
        'asistencia',
        Icons.fact_check_rounded,
        searchable: false,
      ),
      ...common,
      module('Padres', 'padres', Icons.family_restroom_rounded),
      module('Encuestas', 'encuestas', Icons.poll_rounded),
      module('Carnets', 'carnets', Icons.credit_card_rounded),
      module('Auditoría', 'auditoria', Icons.history_rounded),
    ];
  }
  if (role == 'ADMINISTRADOR' || role == 'DIRECTOR') {
    return [
      ...common,
      module(
        'Asistencia',
        'asistencia',
        Icons.fact_check_rounded,
        searchable: false,
      ),
      module('Padres', 'padres', Icons.family_restroom_rounded),
      module('Usuarios', 'usuarios', Icons.manage_accounts_rounded),
      module('Aulas', 'aulas', Icons.meeting_room_rounded),
      module('Secciones', 'aulas/secciones', Icons.account_tree_rounded),
      module('Reportes', 'reportes', Icons.insights_rounded, searchable: false),
      module(
        'Exportaciones',
        'exportaciones',
        Icons.download_rounded,
        searchable: false,
      ),
    ];
  }
  return common;
}

String _schoolRoleLabel(String role) => switch (role) {
  'ADMINISTRADOR' => 'Administración',
  'DIRECTOR' => 'Dirección',
  'SECRETARIA' => 'Secretaría',
  'DOCENTE' => 'Docencia',
  'PADRE' => 'Familia',
  _ => role.toLowerCase().replaceAll('_', ' '),
};

class _WelcomeBanner extends StatelessWidget {
  const _WelcomeBanner({required this.user});
  final SigeUser user;

  @override
  Widget build(BuildContext context) {
    final owlMood = switch (user.role) {
      'SUPERADMIN' => OwlMood.proud,
      'PADRE' => OwlMood.success,
      _ => OwlMood.studying,
    };

    return Container(
      height: 210,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -42,
            top: -54,
            child: Container(
              width: 190,
              height: 190,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.secondary
                    .withValues(alpha: .24),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            left: -28,
            bottom: -70,
            child: Container(
              width: 170,
              height: 170,
              decoration: const BoxDecoration(
                color: Color(0x22FFFFFF),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 24, 150, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hola, ${user.displayName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  user.isSuperAdmin
                      ? 'Controla colegios, licencias y operaciones desde un solo lugar.'
                      : 'Tienes todo listo para organizar tu día escolar.',
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: const Color(0xFFD8E8FF)),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x22FFFFFF),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Text(
                    _roleLabel(user.role),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            right: 0,
            bottom: -8,
            child: OwlCompanion(mood: owlMood, size: 170),
          ),
        ],
      ),
    );
  }

  static String _roleLabel(String role) => switch (role) {
    'SUPERADMIN' => 'Superadministración',
    'ADMINISTRADOR' => 'Administración',
    'DIRECTOR' => 'Dirección',
    'DOCENTE' => 'Docente',
    'PADRE' => 'Familia',
    _ => role.toLowerCase().replaceAll('_', ' '),
  };
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.action, this.onTap});
  final String title;
  final String? action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(title, style: Theme.of(context).textTheme.titleLarge),
      ),
      if (action != null) TextButton(onPressed: onTap, child: Text(action!)),
    ],
  );
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({required this.course});
  final _CourseData course;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Abrir curso ${course.name}',
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => _showModule(context, course.name, course.icon),
        child: Ink(
          width: 160,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: course.color,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0x2AFFFFFF),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(course.icon, color: Colors.white, size: 27),
              ),
              const Spacer(),
              Text(
                course.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Abrir aula',
                style: Theme.of(context).textTheme.labelMedium
                    ?.copyWith(color: const Color(0xE8FFFFFF)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.role});
  final String role;

  @override
  Widget build(BuildContext context) {
    final isFamily = role == 'PADRE';
    final actions = <({ManagementModule module, String description})>[
      (
        module: ManagementModule(
          title: 'Agenda',
          endpoint: 'eventos/proximos',
          icon: Icons.calendar_month_rounded,
          color: const Color(0xFF1A766D),
          searchable: false,
          itemTitle: (item) =>
              item['titulo']?.toString() ?? 'Actividad escolar',
          itemSubtitle: (item) =>
              item['descripcion']?.toString() ?? 'Evento de la institución',
        ),
        description: 'Tareas y eventos',
      ),
      (
        module: ManagementModule(
          title: 'Académico',
          endpoint: isFamily ? 'dashboard/padre' : 'cursos',
          icon: Icons.school_rounded,
          color: const Color(0xFF3756B8),
          searchable: !isFamily,
          itemTitle: (item) => item['nombre']?.toString() ?? 'Aula virtual',
          itemSubtitle: (item) =>
              item['descripcion']?.toString() ?? 'Cursos y avances académicos',
        ),
        description: 'Aula y avances',
      ),
      (
        module: ManagementModule(
          title: 'Asistencia',
          endpoint: isFamily ? 'dashboard/padre' : 'asistencia',
          icon: Icons.how_to_reg_rounded,
          color: const Color(0xFF2C766F),
          searchable: false,
          itemTitle: (item) =>
              item['estado']?.toString() ?? 'Registro de asistencia',
          itemSubtitle: (item) =>
              item['fecha']?.toString() ?? 'Entradas, tardanzas y ausencias',
        ),
        description: 'Entradas y salidas',
      ),
      (
        module: ManagementModule(
          title: 'Calificaciones',
          endpoint: 'notas',
          icon: Icons.auto_stories_rounded,
          color: const Color(0xFF8A642F),
          searchable: false,
          itemTitle: (item) => nestedName(item['curso'], 'Calificación'),
          itemSubtitle: (item) =>
              '${item['periodo'] ?? ''} · ${item['valor'] ?? item['nota'] ?? 'Pendiente'}',
        ),
        description: 'Notas y criterios',
      ),
      (
        module: ManagementModule(
          title: 'Mensajes',
          endpoint: 'chat/conversaciones',
          icon: Icons.mark_chat_unread_rounded,
          color: const Color(0xFF914360),
          searchable: false,
          itemTitle: (item) =>
              item['nombre']?.toString() ??
              item['titulo']?.toString() ??
              'Conversación',
          itemSubtitle: (item) =>
              item['ultimoMensaje']?.toString() ??
              'Comunicación segura del colegio',
        ),
        description: 'Chat y correo',
      ),
      (
        module: ManagementModule(
          title: 'Bienestar',
          endpoint: isFamily ? 'dashboard/padre' : 'observaciones',
          icon: Icons.health_and_safety_rounded,
          color: const Color(0xFF168A55),
          searchable: false,
          itemTitle: (item) =>
              item['tipo']?.toString() ?? 'Seguimiento escolar',
          itemSubtitle: (item) =>
              item['descripcion']?.toString() ?? 'Salud y convivencia',
        ),
        description: 'Salud y convivencia',
      ),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: actions.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisExtent: 104,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemBuilder: (context, index) {
        final item = actions[index];
        final module = item.module;
        return InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ManagementListScreen(module: module),
            ),
          ),
          child: Ink(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: SigeColors.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: module.color.withValues(alpha: .11),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(module.icon, color: module.color),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        module.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall
                            ?.copyWith(color: SigeColors.slate),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _NextActivity extends StatelessWidget {
  const _NextActivity();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: const Color(0xFFE9F4FF),
      borderRadius: BorderRadius.circular(22),
    ),
    child: Row(
      children: [
        const Icon(Icons.schedule_rounded, color: SigeColors.blue, size: 30),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Próxima actividad',
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 3),
              Text(
                'Cuando el colegio publique una tarea, la verás aquí.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _ProfilePage extends ConsumerWidget {
  const _ProfilePage({required this.user});
  final SigeUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) => ListView(
    padding: const EdgeInsets.all(22),
    children: [
      Text('Tu perfil', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 22),
      Center(
        child: Semantics(
          button: true,
          label: 'Abrir opciones de foto de perfil',
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () => _openPhotoMenu(context, ref, user),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                _ProfileAvatar(user: user, size: 84),
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(
                      Icons.camera_alt_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      const SizedBox(height: 12),
      Center(
        child: Text(
          '${user.firstName} ${user.lastName}'.trim(),
          style: Theme.of(context).textTheme.titleLarge,
        ),
      ),
      Center(
        child: Text(user.email, style: Theme.of(context).textTheme.bodyMedium),
      ),
      const SizedBox(height: 28),
      _ProfileAction(
        icon: Icons.person_outline_rounded,
        label: 'Datos personales',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ProfileDetailsScreen(user: user),
          ),
        ),
      ),
      if (!user.isSuperAdmin)
        _ProfileAction(
          icon: Icons.health_and_safety_outlined,
          label: 'Ficha médica',
          onTap: () {},
        ),
      _ProfileAction(
        icon: Icons.notifications_outlined,
        label: 'Preferencias de notificación',
        onTap: () => Navigator.of(context).push<void>(
          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
        ),
      ),
      _ProfileAction(
        icon: Icons.lock_outline_rounded,
        label: 'Seguridad',
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute<void>(builder: (_) => const SecurityScreen())),
      ),
      const SizedBox(height: 16),
      OutlinedButton.icon(
        onPressed: () => ref.read(authControllerProvider.notifier).logout(),
        icon: const Icon(Icons.logout_rounded),
        label: const Text('Cerrar sesión'),
      ),
    ],
  );
}

class _ProfileAction extends StatelessWidget {
  const _ProfileAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    minTileHeight: 60,
    contentPadding: const EdgeInsets.symmetric(horizontal: 4),
    leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
    title: Text(label, style: Theme.of(context).textTheme.labelLarge),
    trailing: const Icon(Icons.chevron_right_rounded),
    onTap: onTap,
  );
}

Future<void> _openPhotoMenu(
  BuildContext context,
  WidgetRef ref,
  SigeUser user,
) async {
  final option = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Foto de perfil',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.fullscreen_rounded),
              title: const Text('Ver foto'),
              onTap: () => Navigator.pop(context, 'view'),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.add_a_photo_outlined),
              title: const Text('Cambiar foto'),
              onTap: () => Navigator.pop(context, 'change'),
            ),
            if (user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.download_rounded),
                title: const Text('Guardar en el dispositivo'),
                onTap: () => Navigator.pop(context, 'download'),
              ),
          ],
        ),
      ),
    ),
  );
  if (option == null || !context.mounted) return;
  if (option == 'view') {
    final url = user.avatarUrl;
    await showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(18),
        child: Stack(
          children: [
            SizedBox(
              width: double.infinity,
              height: MediaQuery.sizeOf(context).height * .66,
              child: url != null && url.isNotEmpty
                  ? InteractiveViewer(
                      minScale: .8,
                      maxScale: 4,
                      child: CachedNetworkImage(
                        imageUrl: url,
                        fit: BoxFit.contain,
                      ),
                    )
                  : Center(child: _ProfileAvatar(user: user, size: 120)),
            ),
            Positioned(
              right: 8,
              top: 8,
              child: IconButton.filled(
                tooltip: 'Cerrar',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded),
              ),
            ),
          ],
        ),
      ),
    );
    return;
  }
  if (option == 'download') {
    try {
      final client = await ref.read(apiClientProvider.future);
      final response = await client.dio.get<List<int>>(
        user.avatarUrl!,
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = response.data;
      if (bytes == null || bytes.isEmpty) throw Exception('Imagen vacía');
      await Gal.putImageBytes(
        Uint8List.fromList(bytes),
        name: 'perfil-sige-${user.id}',
        album: 'SIGE',
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Imagen guardada en la galería, álbum SIGE.'),
          ),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No se pudo guardar la imagen en el dispositivo.'),
          ),
        );
      }
    }
    return;
  }
  final image = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    imageQuality: 88,
    maxWidth: 1200,
  );
  if (image == null) return;
  try {
    final client = await ref.read(apiClientProvider.future);
    await client.dio.post<Map<String, dynamic>>(
      'usuarios/${user.id}/avatar',
      data: FormData.fromMap({
        'avatar': await MultipartFile.fromFile(
          image.path,
          filename: image.name,
        ),
      }),
      options: Options(contentType: 'multipart/form-data'),
    );
    await ref.read(authControllerProvider.notifier).bootstrap();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto de perfil actualizada.')),
      );
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
    }
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.user, required this.size});
  final SigeUser user;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = user.avatarUrl;
    return Container(
      width: size,
      height: size,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: SigeColors.line),
      ),
      child: ClipOval(
        child: url != null && url.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.contain,
                alignment: Alignment.center,
                errorWidget: (_, _, _) => _avatarFallback(context),
              )
            : _avatarFallback(context),
      ),
    );
  }

  Widget _avatarFallback(BuildContext context) => ColoredBox(
    color: Theme.of(context).colorScheme.primary.withValues(alpha: .12),
    child: Center(
      child: Text(
        user.displayName.characters.first.toUpperCase(),
        style: Theme.of(context).textTheme.headlineSmall
            ?.copyWith(color: Theme.of(context).colorScheme.primary),
      ),
    ),
  );
}

class _CourseData {
  const _CourseData(this.name, this.icon, this.color);
  final String name;
  final IconData icon;
  final Color color;
}

String _backupSubtitle(Map<String, dynamic> item) {
  final size = (item['tamanoKB'] as num?)?.toDouble();
  final formattedSize = size == null
      ? 'Tamaño pendiente'
      : size >= 1024
      ? '${(size / 1024).toStringAsFixed(1)} MB'
      : '${size.toStringAsFixed(0)} KB';
  final date = item['createdAt']?.toString().split('T').first ?? 'Sin fecha';
  final status = item['estado']?.toString() ?? 'EN_PROCESO';
  final error = item['error']?.toString();
  return '$status · $formattedSize · $date${error == null || error.isEmpty ? '' : ' · $error'}';
}

void _showModule(BuildContext context, String title, IconData icon) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 4, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: SigeColors.blue, size: 38),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              'Este módulo ya está incluido en la arquitectura y se conectará con los datos reales de SIGE.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 18),
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
}
