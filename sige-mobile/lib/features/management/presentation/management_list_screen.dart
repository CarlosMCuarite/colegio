import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design/app_colors.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/management_repository.dart';
import '../domain/management_module.dart';
import '../../superadmin/presentation/school_detail_screen.dart';
import '../../superadmin/presentation/school_form_screen.dart';
import '../../superadmin/presentation/superadmin_entity_actions.dart';
import 'admin_entity_actions.dart';

final managementPageProvider = FutureProvider.autoDispose
    .family<ManagementPage, ({String endpoint, String query})>((
      ref,
      request,
    ) async {
      final client = await ref.watch(apiClientProvider.future);
      return ManagementRepository(client)
          .list(request.endpoint, query: request.query);
    });

class ManagementListScreen extends ConsumerStatefulWidget {
  const ManagementListScreen({super.key, required this.module});
  final ManagementModule module;

  @override
  ConsumerState<ManagementListScreen> createState() =>
      _ManagementListScreenState();
}

class _ManagementListScreenState extends ConsumerState<ManagementListScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) setState(() => _query = value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final request = (endpoint: widget.module.endpoint, query: _query);
    final page = ref.watch(managementPageProvider(request));
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.module.title),
        actions: widget.module.title == 'Respaldos'
            ? [
                IconButton(
                  tooltip: 'Depurar respaldos rotos',
                  icon: const Icon(Icons.cleaning_services_rounded),
                  onPressed: () async {
                    if (await purgeBrokenBackups(context, ref)) {
                      ref.invalidate(managementPageProvider(request));
                    }
                  },
                ),
              ]
            : widget.module.title == 'Auditoría'
            ? [
                IconButton(
                  tooltip: 'Limpiar registros vencidos',
                  icon: const Icon(Icons.auto_delete_outlined),
                  onPressed: () async {
                    if (await _cleanExpiredAudit(context, ref)) {
                      ref.invalidate(managementPageProvider(request));
                    }
                  },
                ),
              ]
            : null,
      ),
      floatingActionButton: widget.module.title == 'Colegios'
          ? FloatingActionButton.extended(
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const SchoolFormScreen()),
                );
                if (created == true) {
                  ref.invalidate(managementPageProvider(request));
                }
              },
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nuevo'),
            )
          : widget.module.title == 'Membresías'
          ? FloatingActionButton.extended(
              onPressed: () async {
                if (await createSuperAdminPlan(context, ref)) {
                  ref.invalidate(managementPageProvider(request));
                }
              },
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nuevo plan'),
            )
          : widget.module.title == 'Respaldos'
          ? FloatingActionButton.extended(
              onPressed: () async {
                if (await runManualBackup(context, ref)) {
                  ref.invalidate(managementPageProvider(request));
                }
              },
              icon: const Icon(Icons.backup_rounded),
              label: const Text('Respaldar'),
            )
          : widget.module.title == 'Cursos'
          ? FloatingActionButton.extended(
              onPressed: () async {
                if (await createAdminCourse(context, ref)) {
                  ref.invalidate(managementPageProvider(request));
                }
              },
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nuevo curso'),
            )
          : const {
              'Estudiantes',
              'Aulas',
              'Eventos',
            }.contains(widget.module.title)
          ? FloatingActionButton.extended(
              onPressed: () async {
                if (await createAdminEntity(
                  context,
                  ref,
                  widget.module.title,
                )) {
                  ref.invalidate(managementPageProvider(request));
                }
              },
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nuevo'),
            )
          : null,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(managementPageProvider(request).future),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          color: widget.module.color.withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Icon(
                          widget.module.icon,
                          color: widget.module.color,
                          size: 30,
                        ),
                      ),
                      const SizedBox(height: 16),
                      page.maybeWhen(
                        data: (data) => Text(
                          '${data.total} registros',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        orElse: () => Text(
                          'Información de SIGE',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                      ),
                      const SizedBox(height: 5),
                      const Text(
                        'Datos sincronizados con el servidor de Render.',
                      ),
                      if (widget.module.title == 'Facturación')
                        page.maybeWhen(
                          data: (data) => _BillingSummary(meta: data.meta),
                          orElse: () => const SizedBox.shrink(),
                        ),
                      if (widget.module.searchable) ...[
                        const SizedBox(height: 20),
                        TextField(
                          controller: _search,
                          onChanged: _onSearch,
                          textInputAction: TextInputAction.search,
                          decoration: const InputDecoration(
                            labelText: 'Buscar',
                            hintText: 'Nombre, correo o documento',
                            prefixIcon: Icon(Icons.search_rounded),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              page.when(
                loading: () => const SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator.adaptive()),
                ),
                error: (error, _) => SliverFillRemaining(
                  hasScrollBody: false,
                  child: _ErrorState(
                    message: error is ManagementException
                        ? error.message
                        : 'No pudimos cargar esta sección.',
                    onRetry: () =>
                        ref.invalidate(managementPageProvider(request)),
                  ),
                ),
                data: (data) => data.items.isEmpty
                    ? const SliverFillRemaining(
                        hasScrollBody: false,
                        child: _EmptyState(),
                      )
                    : widget.module.title == 'Horarios'
                    ? SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                        sliver: SliverToBoxAdapter(
                          child: _ScheduleBoard(items: data.items),
                        ),
                      )
                    : widget.module.title == 'Eventos'
                    ? SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                        sliver: SliverToBoxAdapter(
                          child: _EventCalendar(items: data.items),
                        ),
                      )
                    : SliverPadding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
                        sliver: SliverList.separated(
                          itemCount: data.items.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final item = data.items[index];
                            final superAdminAction = const {
                              'Usuarios',
                              'Membresías',
                              'Roles por plan',
                              'Licencias',
                              'Facturación',
                              'Respaldos',
                            }.contains(widget.module.title);
                            return _EntityTile(
                              icon: widget.module.icon,
                              color: widget.module.color,
                              title: widget.module.itemTitle(item),
                              subtitle: widget.module.itemSubtitle(item),
                              imageUrl:
                                  widget.module.title == 'Usuarios' ||
                                      widget.module.title == 'Personal' ||
                                      widget.module.title == 'Estudiantes' ||
                                      widget.module.title == 'Colegios'
                                  ? item['avatarUrl']?.toString() ??
                                        item['fotoUrl']?.toString() ??
                                        item['logoUrl']?.toString()
                                  : null,
                              status:
                                  item['estado']?.toString() ??
                                  (item['activo'] is bool
                                      ? (item['activo'] == true
                                            ? 'ACTIVO'
                                            : 'INACTIVO')
                                      : null),
                              details:
                                  widget.module.title == 'Membresías' ||
                                      widget.module.title == 'Roles por plan'
                                  ? _planDetails(item)
                                  : widget.module.title == 'Licencias'
                                  ? _licenseDetails(item)
                                  : widget.module.title == 'Respaldos'
                                  ? _backupDetails(item)
                                  : const [],
                              onTap:
                                  widget.module.title == 'Colegios' &&
                                      item['id'] != null
                                  ? () async {
                                      await Navigator.of(context).push<void>(
                                        MaterialPageRoute(
                                          builder: (_) => SchoolDetailScreen(
                                            schoolId: item['id'].toString(),
                                          ),
                                        ),
                                      );
                                      ref.invalidate(
                                        managementPageProvider(request),
                                      );
                                    }
                                  : item['id'] != null
                                  ? () => widget.module.title == 'Personal'
                                        ? openSuperAdminActions(
                                            context: context,
                                            ref: ref,
                                            module: 'Usuarios',
                                            item: item,
                                            onChanged: () => ref.invalidate(
                                              managementPageProvider(request),
                                            ),
                                          )
                                        : superAdminAction
                                        ? openSuperAdminActions(
                                            context: context,
                                            ref: ref,
                                            module: widget.module.title,
                                            item: item,
                                            onChanged: () => ref.invalidate(
                                              managementPageProvider(request),
                                            ),
                                          )
                                        : openAdminEntityActions(
                                            context: context,
                                            ref: ref,
                                            module: widget.module.title,
                                            item: item,
                                            onChanged: () => ref.invalidate(
                                              managementPageProvider(request),
                                            ),
                                          )
                                  : () {},
                            );
                          },
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScheduleBoard extends StatelessWidget {
  const _ScheduleBoard({required this.items});
  final List<Map<String, dynamic>> items;

  static const days = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final times =
        items
            .map(
              (item) =>
                  '${item['horaInicio'] ?? '—'}–${item['horaFin'] ?? '—'}',
            )
            .toSet()
            .toList()
          ..sort();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Horario semanal',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            Icon(Icons.swipe_rounded, size: 18, color: primary),
            const SizedBox(width: 5),
            const Text('Desliza'),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: primary.withValues(alpha: .16)),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Table(
              defaultColumnWidth: const FixedColumnWidth(132),
              columnWidths: const {0: FixedColumnWidth(92)},
              border: TableBorder.symmetric(
                inside: BorderSide(color: primary.withValues(alpha: .10)),
              ),
              children: [
                TableRow(
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: .09),
                  ),
                  children: [
                    _scheduleCell('Hora', header: true, primary: primary),
                    for (final day in days)
                      _scheduleCell(
                        day.substring(0, 3),
                        header: true,
                        primary: primary,
                      ),
                  ],
                ),
                for (final time in times)
                  TableRow(
                    children: [
                      _scheduleCell(time, header: true, primary: primary),
                      for (final day in days)
                        _scheduleCell(
                          items
                              .where(
                                (item) =>
                                    item['diaSemana']
                                            ?.toString()
                                            .toUpperCase() ==
                                        day &&
                                    '${item['horaInicio'] ?? '—'}–${item['horaFin'] ?? '—'}' ==
                                        time,
                              )
                              .map(
                                (item) => nestedName(
                                  item['curso'],
                                  'Bloque académico',
                                ),
                              )
                              .join('\n'),
                          primary: primary,
                        ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static Widget _scheduleCell(
    String value, {
    required Color primary,
    bool header = false,
  }) => Container(
    constraints: const BoxConstraints(minHeight: 64),
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 11),
    alignment: Alignment.center,
    color: !header && value.isNotEmpty ? primary.withValues(alpha: .055) : null,
    child: Text(
      value.isEmpty ? '—' : value,
      textAlign: TextAlign.center,
      maxLines: 3,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontSize: header ? 12 : 13,
        fontWeight: header ? FontWeight.w900 : FontWeight.w700,
        color: header ? primary : null,
      ),
    ),
  );
}

class _EventCalendar extends ConsumerStatefulWidget {
  const _EventCalendar({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  ConsumerState<_EventCalendar> createState() => _EventCalendarState();
}

class _EventCalendarState extends ConsumerState<_EventCalendar> {
  late DateTime month = DateTime(DateTime.now().year, DateTime.now().month);

  void _move(int delta) =>
      setState(() => month = DateTime(month.year, month.month + delta));

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month, 1);
    final days = DateTime(month.year, month.month + 1, 0).day;
    final leading = first.weekday % 7;
    final primary = Theme.of(context).colorScheme.primary;
    final byDay = <int, List<Map<String, dynamic>>>{};
    for (final item in widget.items) {
      final raw = item['fechaInicio']?.toString();
      // Los eventos escolares de día completo son fechas civiles, no instantes
      // UTC: conservar YYYY-MM-DD evita que Lima muestre el día anterior.
      final date = raw == null ? null : DateTime.tryParse(raw.split('T').first);
      if (date != null &&
          date.year == month.year &&
          date.month == month.month) {
        byDay.putIfAbsent(date.day, () => []).add(item);
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton.filledTonal(
              onPressed: () => _move(-1),
              icon: const Icon(Icons.chevron_left_rounded),
            ),
            Expanded(
              child: Text(
                '${_monthName(month.month)} ${month.year}',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            IconButton.filledTonal(
              onPressed: () => _move(1),
              icon: const Icon(Icons.chevron_right_rounded),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: primary.withValues(alpha: .14)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  for (final day in ['D', 'L', 'M', 'M', 'J', 'V', 'S'])
                    Expanded(child: Center(child: Text(day))),
                ],
              ),
              const SizedBox(height: 8),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: leading + days,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisExtent: 48,
                ),
                itemBuilder: (context, index) {
                  if (index < leading) return const SizedBox.shrink();
                  final day = index - leading + 1;
                  final hasEvent = byDay[day]?.isNotEmpty == true;
                  return InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: hasEvent
                        ? () => _showDay(context, byDay[day]!)
                        : null,
                    child: Container(
                      margin: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: hasEvent
                            ? primary
                            : primary.withValues(alpha: .045),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Text(
                          '$day',
                          style: TextStyle(
                            color: hasEvent ? Colors.white : null,
                            fontWeight: hasEvent
                                ? FontWeight.w900
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ExpansionTile(
            leading: Icon(Icons.history_rounded, color: primary),
            title: const Text('Ver otros eventos'),
            subtitle: Text('${widget.items.length} registrados'),
            children: [
              for (final item in widget.items)
                _eventTile(context, item, primary),
            ],
          ),
        ),
      ],
    );
  }

  void _showDay(BuildContext context, List<Map<String, dynamic>> events) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Eventos del día',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              for (final event in events)
                _eventTile(
                  context,
                  event,
                  Theme.of(context).colorScheme.primary,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _eventTile(
    BuildContext context,
    Map<String, dynamic> item,
    Color primary,
  ) => ListTile(
    leading: Icon(Icons.event_rounded, color: primary),
    title: Text(item['titulo']?.toString() ?? 'Evento'),
    subtitle: Text(item['fechaInicio']?.toString().split('T').first ?? ''),
    trailing: const Icon(Icons.chevron_right_rounded),
    onTap: () => openAdminEntityActions(
      context: context,
      ref: ref,
      module: 'Eventos',
      item: item,
      onChanged: () {},
    ),
  );

  static String _monthName(int month) => const [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ][month - 1];
}

Future<bool> _cleanExpiredAudit(BuildContext context, WidgetRef ref) async {
  final confirmed =
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Limpiar auditoría vencida'),
          content: const Text(
            'Se eliminarán únicamente accesos con más de 90 días y operaciones con más de 730 días. Los registros recientes permanecerán intactos.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Aplicar retención'),
            ),
          ],
        ),
      ) ??
      false;
  if (!confirmed || !context.mounted) return false;
  try {
    final client = await ref.read(apiClientProvider.future);
    final response = await client.dio.post<Map<String, dynamic>>(
      'auditoria/limpiar-vencidos',
    );
    final data = response.data?['data'];
    final removed = data is Map<String, dynamic> ? data['eliminados'] ?? 0 : 0;
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$removed registros vencidos eliminados.')),
      );
    return true;
  } catch (_) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo aplicar la retención de auditoría.'),
        ),
      );
    return false;
  }
}

class _EntityTile extends StatelessWidget {
  const _EntityTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.imageUrl,
    this.status,
    this.details = const [],
  });
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final String? imageUrl;
  final String? status;
  final List<String> details;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(19),
    child: InkWell(
      borderRadius: BorderRadius.circular(19),
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 78),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          border: Border.all(color: SigeColors.line),
          borderRadius: BorderRadius.circular(19),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 23,
              backgroundColor: color.withValues(alpha: .11),
              foregroundColor: color,
              backgroundImage: imageUrl != null && imageUrl!.isNotEmpty
                  ? CachedNetworkImageProvider(imageUrl!)
                  : null,
              child: imageUrl == null || imageUrl!.isEmpty
                  ? Icon(icon, size: 21)
                  : null,
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: SigeColors.slate),
                        ),
                      ),
                      if (status != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: _statusColor(status!).withValues(alpha: .11),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            status!.replaceAll('_', ' '),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: _statusColor(status!),
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (details.isNotEmpty) ...[
                    const SizedBox(height: 7),
                    Wrap(
                      spacing: 6,
                      runSpacing: 5,
                      children: [
                        for (final detail in details.take(4))
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5FA),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              detail,
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    ),
  );

  static Color _statusColor(String status) => switch (status) {
    'ACTIVO' || 'COMPLETADO' || 'APROBADO' => const Color(0xFF168A55),
    'FALLIDO' || 'RECHAZADO' || 'SUSPENDIDO' => SigeColors.danger,
    'PENDIENTE' || 'EN_PROCESO' || 'EN_REVISION' => const Color(0xFFB87822),
    _ => SigeColors.slate,
  };
}

List<String> _planDetails(Map<String, dynamic> item) {
  final modules = item['modulosActivos'];
  final roles = item['rolesHabilitados'];
  final schoolCount = item['_count'] is Map<String, dynamic>
      ? item['_count']['colegios']
      : null;
  return [
    '${item['maxEstudiantes'] ?? 0} estudiantes',
    '${item['maxUsuarios'] ?? 0} usuarios',
    if (modules is List) '${modules.length} módulos',
    if (roles is List) '${roles.length} roles habilitados',
    if (schoolCount != null) '$schoolCount colegios',
  ];
}

List<String> _licenseDetails(Map<String, dynamic> item) {
  final plan = item['plan'];
  final planName = plan is Map ? plan['nombre']?.toString() : null;
  final end = DateTime.tryParse(item['licenciaFin']?.toString() ?? '');
  final days = end?.difference(DateTime.now()).inDays;
  return [
    if (planName != null && planName.isNotEmpty) 'Plan $planName',
    if (days != null)
      days >= 0 ? '$days días restantes' : 'Vencida hace ${days.abs()} días',
  ];
}

List<String> _backupDetails(Map<String, dynamic> item) => [
  if (item['tamanoBytes'] is num)
    '${((item['tamanoBytes'] as num) / 1024 / 1024).toStringAsFixed(2)} MB',
  if (item['totalRegistros'] != null) '${item['totalRegistros']} registros',
  if (item['tipo'] != null) item['tipo'].toString(),
];

class _BillingSummary extends StatelessWidget {
  const _BillingSummary({required this.meta});
  final Map<String, dynamic> meta;

  @override
  Widget build(BuildContext context) {
    final raw = meta['resumen'];
    final items = raw is List
        ? raw.whereType<Map<String, dynamic>>()
        : const <Map<String, dynamic>>[];
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: SizedBox(
        height: 88,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: 10),
          itemBuilder: (context, index) {
            final item = items.elementAt(index);
            return Container(
              width: 150,
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F7FC),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item['estado']?.toString().replaceAll('_', ' ') ?? 'ESTADO',
                  ),
                  const Spacer(),
                  Text(
                    '${item['cantidad'] ?? 0} · S/ ${item['monto'] ?? 0}',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(32),
      child: Text('No hay registros que coincidan con la búsqueda.'),
    ),
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            size: 42,
            color: SigeColors.slate,
          ),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton.tonal(
            onPressed: onRetry,
            child: const Text('Reintentar'),
          ),
        ],
      ),
    ),
  );
}
