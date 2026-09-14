import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design/app_colors.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../management/domain/management_module.dart';
import '../../management/presentation/management_list_screen.dart';

class SchoolSupportScreen extends ConsumerStatefulWidget {
  const SchoolSupportScreen({super.key, required this.school});
  final Map<String, dynamic> school;

  @override
  ConsumerState<SchoolSupportScreen> createState() =>
      _SchoolSupportScreenState();
}

class _SchoolSupportScreenState extends ConsumerState<SchoolSupportScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      final client = await ref.read(apiClientProvider.future);
      client.useSchoolContext(widget.school['id'].toString());
    });
  }

  @override
  void dispose() {
    ref.read(apiClientProvider.future).then((client) {
      client.restoreDefaultSchoolContext();
    });
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final modules = _supportModules;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.school['nombre']?.toString() ?? 'Soporte'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFFE9F4FF),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, color: SigeColors.blue),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Modo soporte auditado. Conservas tu identidad de Super Admin y cada operación queda registrada.',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Gestión del colegio',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 14),
            for (final module in modules)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  minTileHeight: 72,
                  leading: CircleAvatar(
                    backgroundColor: module.color.withValues(alpha: .12),
                    foregroundColor: module.color,
                    child: Icon(module.icon),
                  ),
                  title: Text(module.title),
                  subtitle: const Text('Administrar registros del colegio'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (_) => ManagementListScreen(module: module),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

final _supportModules = <ManagementModule>[
  ManagementModule(
    title: 'Estudiantes',
    endpoint: 'estudiantes',
    icon: Icons.groups_rounded,
    color: SigeColors.blue,
    itemTitle: joinedName,
    itemSubtitle: (item) => item['dni']?.toString() ?? 'Sin DNI',
  ),
  ManagementModule(
    title: 'Matrículas',
    endpoint: 'matriculas',
    icon: Icons.badge_rounded,
    color: const Color(0xFF0E8A86),
    itemTitle: (item) => item['estudiante'] is Map<String, dynamic>
        ? joinedName(item['estudiante'] as Map<String, dynamic>)
        : 'Matrícula',
    itemSubtitle: (item) =>
        '${nestedName(item['nivelGrado'])} · ${item['anoEscolar'] ?? ''}',
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
    title: 'Auditoría',
    endpoint: 'auditoria',
    icon: Icons.fact_check_rounded,
    color: const Color(0xFF54738C),
    itemTitle: (item) => item['accion']?.toString() ?? 'Actividad',
    itemSubtitle: (item) =>
        '${item['modulo'] ?? 'SIGE'} · ${item['descripcion'] ?? ''}',
  ),
];
