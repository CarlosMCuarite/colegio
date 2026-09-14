import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../superadmin/data/superadmin_repository.dart';

Future<void> openAdminEntityActions({
  required BuildContext context,
  required WidgetRef ref,
  required String module,
  required Map<String, dynamic> item,
  required VoidCallback onChanged,
}) async {
  final actions = _actions(module, item);
  final selected = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(module, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            for (final action in actions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(action.$3, color: action.$4 ? Colors.red : null),
                title: Text(
                  action.$2,
                  style: TextStyle(color: action.$4 ? Colors.red : null),
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.pop(context, action.$1),
              ),
          ],
        ),
      ),
    ),
  );
  if (selected == null || !context.mounted) return;
  try {
    final client = await ref.read(apiClientProvider.future);
    final api = SuperAdminRepository(client);
    final id = item['id']?.toString() ?? '';
    switch (selected) {
      case 'view_details':
        if (context.mounted) await _showDetails(context, module, item);
        return;
      case 'edit_course':
        if (!context.mounted) return;
        final values = await _courseForm(context, initial: item);
        if (values == null) return;
        await api.patch('cursos/$id', values);
        break;
      case 'edit_student':
        if (!context.mounted) return;
        final values = await _studentForm(context, item);
        if (values == null) return;
        await api.patch('estudiantes/$id', values);
        break;
      case 'edit_parent':
        if (!context.mounted) return;
        final values = await _parentForm(context, item);
        if (values == null) return;
        await api.patch('padres/$id', values);
        break;
      case 'edit_enrollment':
        if (!context.mounted) return;
        final values = await _enrollmentForm(context, item);
        if (values == null) return;
        await api.patch('matriculas/$id', values);
        break;
      case 'validate_permission':
        await api.patch('permisos/$id/validar', {'llamadaConfirmada': true});
        break;
      case 'approve_permission':
        await api.patch('permisos/$id/autorizar', {'autorizado': true});
        break;
      case 'reject_permission':
        final reason = await _reason(context, 'Motivo de denegación');
        if (reason == null) return;
        await api.patch('permisos/$id/autorizar', {
          'autorizado': false,
          'observaciones': reason,
        });
        break;
      case 'execute_permission':
        await api.patch('permisos/$id/ejecutar');
        break;
      case 'approve_payment':
        await api.patch('pagos/$id/aprobar');
        break;
      case 'reject_payment':
        final reason = await _reason(context, 'Motivo del rechazo');
        if (reason == null || reason.length < 5) return;
        await api.patch('pagos/$id/rechazar', {'observaciones': reason});
        break;
      case 'delete_student':
        if (!await _confirm(
          context,
          'El estudiante pasará a la papelera. ¿Continuar?',
        ))
          return;
        await api.delete('estudiantes/$id');
        break;
      case 'delete_course':
        if (!await _confirm(context, '¿Eliminar este curso?')) return;
        await api.delete('cursos/$id');
        break;
      case 'delete_classroom':
        if (!await _confirm(context, '¿Eliminar esta aula?')) return;
        await api.delete('aulas/$id');
        break;
      case 'delete_section':
        if (!await _confirm(context, '¿Eliminar esta sección?')) return;
        await api.delete('aulas/secciones/$id');
        break;
      case 'delete_announcement':
        if (!await _confirm(context, '¿Eliminar este comunicado?')) return;
        await api.delete('comunicados/$id');
        break;
      case 'delete_event':
        if (!await _confirm(context, '¿Eliminar este evento?')) return;
        await api.delete('eventos/$id');
        break;
    }
    onChanged();
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Operación completada.')));
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
    }
  }
}

List<(String, String, IconData, bool)> _actions(
  String module,
  Map<String, dynamic> item,
) {
  final state = item['estado']?.toString();
  final specific = switch (module) {
    'Permisos de salida' => [
      if (state == 'SOLICITADO')
        (
          'validate_permission',
          'Validar llamada al apoderado',
          Icons.phone_in_talk_rounded,
          false,
        ),
      if (state == 'VALIDADO')
        (
          'approve_permission',
          'Autorizar salida',
          Icons.check_circle_outline_rounded,
          false,
        ),
      if (state == 'VALIDADO')
        ('reject_permission', 'Denegar salida', Icons.cancel_outlined, true),
      if (state == 'AUTORIZADO')
        (
          'execute_permission',
          'Registrar salida efectiva',
          Icons.exit_to_app_rounded,
          false,
        ),
    ],
    'Tesorería' || 'Pagos' => [
      if (state == 'EN_REVISION')
        (
          'approve_payment',
          'Aprobar pago',
          Icons.check_circle_outline_rounded,
          false,
        ),
      if (state == 'EN_REVISION')
        ('reject_payment', 'Rechazar pago', Icons.cancel_outlined, true),
    ],
    'Estudiantes' => [
      ('edit_student', 'Editar estudiante', Icons.edit_outlined, false),
      (
        'delete_student',
        'Enviar a papelera',
        Icons.delete_outline_rounded,
        true,
      ),
    ],
    'Padres' => [
      ('edit_parent', 'Editar apoderado', Icons.edit_outlined, false),
    ],
    'Matrículas' => [
      ('edit_enrollment', 'Editar matrícula', Icons.edit_outlined, false),
    ],
    'Cursos' => [
      ('edit_course', 'Editar curso', Icons.edit_outlined, false),
      ('delete_course', 'Eliminar curso', Icons.delete_outline_rounded, true),
    ],
    'Aulas' => [
      ('delete_classroom', 'Eliminar aula', Icons.delete_outline_rounded, true),
    ],
    'Secciones' => [
      (
        'delete_section',
        'Eliminar sección',
        Icons.delete_outline_rounded,
        true,
      ),
    ],
    'Comunicados' => [
      (
        'delete_announcement',
        'Eliminar comunicado',
        Icons.delete_outline_rounded,
        true,
      ),
    ],
    'Eventos' => [
      ('delete_event', 'Eliminar evento', Icons.delete_outline_rounded, true),
    ],
    _ => const [],
  };
  return [
    ('view_details', 'Ver ficha completa', Icons.visibility_outlined, false),
    ...specific,
  ];
}

Future<bool> createAdminCourse(BuildContext context, WidgetRef ref) async {
  final values = await _courseForm(context);
  if (values == null || !context.mounted) return false;
  try {
    final client = await ref.read(apiClientProvider.future);
    await SuperAdminRepository(client).post('cursos', values);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Curso creado correctamente.')),
      );
    }
    return true;
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
    }
    return false;
  }
}

Future<Map<String, dynamic>?> _courseForm(
  BuildContext context, {
  Map<String, dynamic>? initial,
}) {
  final name = TextEditingController(text: initial?['nombre']?.toString());
  final description = TextEditingController(
    text: initial?['descripcion']?.toString(),
  );
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(initial == null ? 'Nuevo curso' : 'Editar curso'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: name,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Nombre del curso'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: description,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Descripción'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () {
            if (name.text.trim().isEmpty) return;
            Navigator.pop(context, {
              'nombre': name.text.trim(),
              'descripcion': description.text.trim(),
            });
          },
          child: const Text('Guardar'),
        ),
      ],
    ),
  );
}

Future<void> _showDetails(
  BuildContext context,
  String module,
  Map<String, dynamic> item,
) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (context) {
    const hidden = {'id', 'createdAt', 'updatedAt', 'password', 'supabaseId'};
    final entries = item.entries
        .where(
          (entry) =>
              !hidden.contains(entry.key) &&
              !entry.key.endsWith('Id') &&
              entry.value != null,
        )
        .toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: .68,
      maxChildSize: .92,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(22, 4, 22, 30),
        children: [
          Text(
            'Ficha de $module',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 6),
          Text(
            'Información sincronizada del registro.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          for (final entry in entries)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(_fieldLabel(entry.key)),
              subtitle: Text(_detailValue(entry.value)),
            ),
        ],
      ),
    );
  },
);

String _detailValue(dynamic value) {
  if (value is List) {
    if (value.isEmpty) return 'Sin registros';
    return value.map(_detailValue).join('\n\n');
  }
  if (value is Map) {
    return value.entries
        .where((entry) => entry.value != null && entry.key != 'id')
        .map(
          (entry) =>
              '${_fieldLabel(entry.key.toString())}: ${_detailValue(entry.value)}',
        )
        .join('\n');
  }
  final raw = value.toString();
  final isoDate = RegExp(r'^\d{4}-\d{2}-\d{2}(?:T.*)?$');
  if (isoDate.hasMatch(raw)) {
    final parts = raw.substring(0, 10).split('-');
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
  if (value is bool) return value ? 'Sí' : 'No';
  return raw;
}

Future<Map<String, dynamic>?> _studentForm(
  BuildContext context,
  Map<String, dynamic> initial,
) => _recordForm(
  context,
  title: 'Editar estudiante',
  fields: const [
    ('dni', 'DNI'),
    ('nombres', 'Nombres'),
    ('apellidos', 'Apellidos'),
    ('fechaNacimiento', 'Fecha de nacimiento (AAAA-MM-DD)'),
    ('direccion', 'Dirección'),
    ('anoIngreso', 'Año de ingreso'),
    ('estado', 'Estado'),
  ],
  initial: initial,
  numeric: const {'anoIngreso'},
);

Future<Map<String, dynamic>?> _parentForm(
  BuildContext context,
  Map<String, dynamic> initial,
) => _recordForm(
  context,
  title: 'Editar padre o apoderado',
  fields: const [
    ('dni', 'DNI'),
    ('nombres', 'Nombres'),
    ('apellidos', 'Apellidos'),
    ('email', 'Correo electrónico'),
    ('telefono', 'Teléfono principal'),
    ('telefono2', 'Teléfono alternativo'),
    ('direccion', 'Dirección'),
  ],
  initial: initial,
);

Future<Map<String, dynamic>?> _enrollmentForm(
  BuildContext context,
  Map<String, dynamic> initial,
) => _recordForm(
  context,
  title: 'Editar matrícula',
  fields: const [
    ('nivelGradoId', 'ID del nivel o grado'),
    ('seccionId', 'ID de la sección'),
    ('anoEscolar', 'Año escolar'),
    ('observaciones', 'Observaciones'),
  ],
  initial: initial,
  numeric: const {'anoEscolar'},
);

Future<Map<String, dynamic>?> _recordForm(
  BuildContext context, {
  required String title,
  required List<(String, String)> fields,
  required Map<String, dynamic> initial,
  Set<String> numeric = const {},
}) {
  final controllers = {
    for (final field in fields)
      field.$1: TextEditingController(
        text: initial[field.$1]?.toString() ?? '',
      ),
  };
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 460,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final field in fields) ...[
                TextField(
                  controller: controllers[field.$1],
                  keyboardType: numeric.contains(field.$1)
                      ? TextInputType.number
                      : TextInputType.text,
                  decoration: InputDecoration(labelText: field.$2),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () {
            final values = <String, dynamic>{};
            for (final field in fields) {
              final value = controllers[field.$1]!.text.trim();
              values[field.$1] = numeric.contains(field.$1)
                  ? int.tryParse(value)
                  : (value.isEmpty ? null : value);
            }
            Navigator.pop(context, values);
          },
          child: const Text('Guardar cambios'),
        ),
      ],
    ),
  );
}

String _fieldLabel(String value) => value
    .replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}')
    .replaceFirstMapped(
      RegExp(r'^.'),
      (match) => match.group(0)!.toUpperCase(),
    );

Future<bool> _confirm(BuildContext context, String message) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar operación'),
        content: Text(message),
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
    ) ??
    false;

Future<String?> _reason(BuildContext context, String label) async {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(label),
      content: TextField(
        controller: controller,
        maxLines: 3,
        decoration: const InputDecoration(labelText: 'Observaciones'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: const Text('Continuar'),
        ),
      ],
    ),
  );
}
