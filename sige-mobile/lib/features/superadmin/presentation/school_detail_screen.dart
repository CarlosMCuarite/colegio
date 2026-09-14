import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design/app_colors.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/school_repository.dart';
import 'school_form_screen.dart';
import 'school_support_screen.dart';

final schoolDetailProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, id) async {
      final client = await ref.watch(apiClientProvider.future);
      return SchoolRepository(client).detail(id);
    });

class SchoolDetailScreen extends ConsumerWidget {
  const SchoolDetailScreen({super.key, required this.schoolId});
  final String schoolId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final school = ref.watch(schoolDetailProvider(schoolId));
    return Scaffold(
      appBar: AppBar(title: const Text('Detalle del colegio')),
      body: school.when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (error, _) => _MessageState(
          message: SchoolRepository.errorMessage(error),
          onRetry: () => ref.invalidate(schoolDetailProvider(schoolId)),
        ),
        data: (data) => _SchoolDetail(
          school: data,
          onRefresh: () => ref.invalidate(schoolDetailProvider(schoolId)),
        ),
      ),
    );
  }
}

class _SchoolDetail extends ConsumerWidget {
  const _SchoolDetail({required this.school, required this.onRefresh});
  final Map<String, dynamic> school;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = school['id'].toString();
    final status = school['estado']?.toString() ?? 'INACTIVO';
    final counts = school['_count'];
    final count = counts is Map<String, dynamic>
        ? counts
        : const <String, dynamic>{};
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: const Color(0xFFDDEBFF),
              backgroundImage: school['logoUrl'] is String
                  ? NetworkImage(school['logoUrl'] as String)
                  : null,
              child: school['logoUrl'] == null
                  ? const Icon(Icons.apartment_rounded, color: SigeColors.blue)
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    school['nombre']?.toString() ?? 'Colegio',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text('$status · ${school['ruc'] ?? 'Sin RUC'}'),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),
        Row(
          children: [
            _Stat(label: 'Usuarios', value: '${count['usuarios'] ?? 0}'),
            const SizedBox(width: 10),
            _Stat(label: 'Estudiantes', value: '${count['estudiantes'] ?? 0}'),
            const SizedBox(width: 10),
            _Stat(label: 'Matrículas', value: '${count['matriculas'] ?? 0}'),
          ],
        ),
        const SizedBox(height: 22),
        _Info(label: 'ID para la app', value: id),
        _Info(label: 'Slug', value: school['slug']?.toString() ?? '—'),
        _Info(label: 'Plan', value: _nestedName(school['plan'])),
        _Info(label: 'Correo', value: school['email']?.toString() ?? '—'),
        _Info(label: 'Teléfono', value: school['telefono']?.toString() ?? '—'),
        _Info(
          label: 'Dirección',
          value: school['direccion']?.toString() ?? '—',
        ),
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: () async {
            final changed = await Navigator.of(context).push<bool>(
              MaterialPageRoute(
                builder: (_) => SchoolFormScreen(school: school),
              ),
            );
            if (changed == true) onRefresh();
          },
          icon: const Icon(Icons.edit_rounded),
          label: const Text('Editar colegio'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => _changeStatus(context, ref, id, status),
          icon: Icon(
            status == 'ACTIVO'
                ? Icons.pause_circle_outline
                : Icons.play_circle_outline,
          ),
          label: Text(
            status == 'ACTIVO' ? 'Suspender colegio' : 'Activar colegio',
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => _support(context, ref, id),
          icon: const Icon(Icons.support_agent_rounded),
          label: const Text('Generar acceso de soporte'),
        ),
      ],
    );
  }

  Future<void> _changeStatus(
    BuildContext context,
    WidgetRef ref,
    String id,
    String current,
  ) async {
    final next = current == 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(next == 'ACTIVO' ? 'Activar colegio' : 'Suspender colegio'),
        content: Text(
          next == 'ACTIVO'
              ? 'Los usuarios podrán volver a iniciar sesión.'
              : 'Las sesiones del colegio se cerrarán y no podrán ingresar.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      final client = await ref.read(apiClientProvider.future);
      await SchoolRepository(client).setStatus(id, next);
      ref.invalidate(schoolDetailProvider(id));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Estado actualizado correctamente.')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(SchoolRepository.errorMessage(error))),
        );
      }
    }
  }

  Future<void> _support(BuildContext context, WidgetRef ref, String id) async {
    try {
      final client = await ref.read(apiClientProvider.future);
      final result = await SchoolRepository(client).supportAccess(id);
      if (!context.mounted) return;
      final school = result['colegio'] is Map<String, dynamic>
          ? result['colegio'] as Map<String, dynamic>
          : <String, dynamic>{'id': id, 'nombre': 'Colegio'};
      await Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => SchoolSupportScreen(school: school)),
      );
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(SchoolRepository.errorMessage(error))),
        );
      }
    }
  }

  String _nestedName(dynamic value) => value is Map<String, dynamic>
      ? value['nombre']?.toString() ?? 'Sin plan'
      : 'Sin plan';
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF2FC),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text(value, style: Theme.of(context).textTheme.titleLarge),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    ),
  );
}

class _Info extends StatelessWidget {
  const _Info({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label, style: Theme.of(context).textTheme.labelMedium),
    subtitle: Text(value, style: Theme.of(context).textTheme.bodyLarge),
  );
}

class _MessageState extends StatelessWidget {
  const _MessageState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(message),
        const SizedBox(height: 12),
        FilledButton.tonal(onPressed: onRetry, child: const Text('Reintentar')),
      ],
    ),
  );
}
