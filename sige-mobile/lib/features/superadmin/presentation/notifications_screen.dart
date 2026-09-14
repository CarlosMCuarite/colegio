import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design/app_colors.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../management/domain/management_module.dart';
import '../../management/presentation/management_list_screen.dart';
import '../data/superadmin_repository.dart';

final notificationsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      final client = await ref.watch(apiClientProvider.future);
      final response = await SuperAdminRepository(client)
          .get('dashboard/notificaciones');
      final raw = response['data'];
      final data = raw is Map<String, dynamic> ? raw['notificaciones'] : raw;
      return data is List
          ? data.whereType<Map<String, dynamic>>().toList()
          : const [];
    });

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          TextButton(
            onPressed: () => _markAll(context, ref),
            child: const Text('Leer todas'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(notificationsProvider.future),
        child: state.when(
          loading: () =>
              const Center(child: CircularProgressIndicator.adaptive()),
          error: (error, _) => ListView(
            children: [
              const SizedBox(height: 200),
              Text(
                SuperAdminRepository.message(error),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          data: (items) => items.isEmpty
              ? ListView(
                  children: const [
                    SizedBox(height: 180),
                    Icon(
                      Icons.notifications_none_rounded,
                      size: 52,
                      color: SigeColors.slate,
                    ),
                    SizedBox(height: 12),
                    Text(
                      'No tienes notificaciones pendientes.',
                      textAlign: TextAlign.center,
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 30),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 9),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    final read = item['leida'] == true;
                    return Material(
                      color: read ? Colors.white : const Color(0xFFF0F6FF),
                      borderRadius: BorderRadius.circular(19),
                      child: ListTile(
                        minTileHeight: 82,
                        shape: RoundedRectangleBorder(
                          side: const BorderSide(color: SigeColors.line),
                          borderRadius: BorderRadius.circular(19),
                        ),
                        leading: CircleAvatar(
                          backgroundColor: SigeColors.blue.withValues(
                            alpha: .1,
                          ),
                          foregroundColor: SigeColors.blue,
                          child: Icon(_icon(item)),
                        ),
                        title: Text(
                          item['titulo']?.toString() ?? 'Notificación',
                          style: TextStyle(
                            fontWeight: read
                                ? FontWeight.w600
                                : FontWeight.w800,
                          ),
                        ),
                        subtitle: Text(
                          item['mensaje']?.toString() ??
                              item['descripcion']?.toString() ??
                              '',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => _open(context, ref, item),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

IconData _icon(Map<String, dynamic> item) {
  final value = '${item['tipo'] ?? ''} ${item['ruta'] ?? ''}'.toLowerCase();
  if (value.contains('pago') || value.contains('factur'))
    return Icons.receipt_long_rounded;
  if (value.contains('backup') || value.contains('respaldo'))
    return Icons.cloud_sync_rounded;
  if (value.contains('licencia')) return Icons.verified_user_rounded;
  if (value.contains('colegio')) return Icons.apartment_rounded;
  return Icons.notifications_active_rounded;
}

Future<void> _open(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> item,
) async {
  final id = item['id']?.toString();
  try {
    if (id != null) {
      final api = SuperAdminRepository(
        await ref.read(apiClientProvider.future),
      );
      await api.patch('dashboard/notificaciones/$id/leer');
      ref.invalidate(notificationsProvider);
    }
  } catch (_) {}
  if (!context.mounted) return;
  final value = '${item['tipo'] ?? ''} ${item['ruta'] ?? ''}'.toLowerCase();
  final module = value.contains('pago') || value.contains('factur')
      ? ManagementModule(
          title: 'Facturación',
          endpoint: 'pagos-licencia',
          icon: Icons.receipt_long_rounded,
          color: const Color(0xFFB75A45),
          searchable: false,
          itemTitle: (row) => row['colegio'] is Map
              ? row['colegio']['nombre']?.toString() ?? 'Pago'
              : 'Pago',
          itemSubtitle: (row) =>
              'S/ ${row['monto'] ?? 0} · ${row['estado'] ?? 'PENDIENTE'}',
        )
      : value.contains('backup') || value.contains('respaldo')
      ? ManagementModule(
          title: 'Respaldos',
          endpoint: 'backups',
          icon: Icons.cloud_sync_rounded,
          color: const Color(0xFF54738C),
          searchable: false,
          itemTitle: (row) => row['nombre']?.toString() ?? 'Respaldo',
          itemSubtitle: (row) => row['estado']?.toString() ?? 'Sin estado',
        )
      : ManagementModule(
          title: 'Licencias',
          endpoint: 'colegios',
          icon: Icons.verified_user_rounded,
          color: const Color(0xFF0E8A86),
          itemTitle: (row) => row['nombre']?.toString() ?? 'Colegio',
          itemSubtitle: (row) =>
              '${row['estado'] ?? 'INACTIVO'} · ${row['licenciaFin']?.toString().split('T').first ?? 'sin fecha'}',
        );
  await Navigator.of(context).push<void>(
    MaterialPageRoute(builder: (_) => ManagementListScreen(module: module)),
  );
}

Future<void> _markAll(BuildContext context, WidgetRef ref) async {
  try {
    final api = SuperAdminRepository(await ref.read(apiClientProvider.future));
    await api.post('dashboard/notificaciones/leer');
    ref.invalidate(notificationsProvider);
  } catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
  }
}
