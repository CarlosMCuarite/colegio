import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../data/superadmin_repository.dart';

Future<bool> createSuperAdminPlan(BuildContext context, WidgetRef ref) async {
  final values = await _planForm(context, const {}, creating: true);
  if (values == null || !context.mounted) return false;
  try {
    final client = await ref.read(apiClientProvider.future);
    await SuperAdminRepository(client).post('membresias/planes', values);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Plan creado correctamente.')),
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

Future<bool> runManualBackup(BuildContext context, WidgetRef ref) async {
  if (!await _confirm(context, '¿Generar ahora un respaldo global?')) {
    return false;
  }
  try {
    final client = await ref.read(apiClientProvider.future);
    await SuperAdminRepository(client).post('backups');
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Respaldo solicitado.')));
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

Future<bool> purgeBrokenBackups(BuildContext context, WidgetRef ref) async {
  if (!await _confirm(
    context,
    'Se comprobará Storage y se eliminarán registros sin archivo. ¿Continuar?',
  )) {
    return false;
  }
  try {
    final client = await ref.read(apiClientProvider.future);
    final result = await SuperAdminRepository(client)
        .post('backups/purgar-rotos');
    if (context.mounted) {
      await _showValue(
        context,
        'Depuración terminada',
        'Revisados: ${result['revisados'] ?? 0}\nPurgados: ${result['purgados'] ?? 0}',
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

Future<void> diagnoseBackupStorage(BuildContext context, WidgetRef ref) async {
  try {
    final client = await ref.read(apiClientProvider.future);
    final result = await SuperAdminRepository(client)
        .post('backups/diagnostico-storage');
    if (context.mounted) {
      await _showValue(
        context,
        'Diagnóstico de Storage',
        result['data']?['escritura'] == true &&
                result['data']?['limpieza'] == true
            ? 'El bucket permite escribir y limpiar archivos correctamente.'
            : _pretty(result['data'] ?? result),
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

Future<void> openSuperAdminActions({
  required BuildContext context,
  required WidgetRef ref,
  required String module,
  required Map<String, dynamic> item,
  required VoidCallback onChanged,
}) async {
  final actions = _actionsFor(module, item);
  if (actions.isEmpty) return;
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _title(item, module),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(module, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 16),
            for (final action in actions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  action.icon,
                  color: action.destructive ? Colors.red : null,
                ),
                title: Text(
                  action.label,
                  style: TextStyle(
                    color: action.destructive ? Colors.red : null,
                  ),
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  await _execute(
                    context,
                    ref,
                    module,
                    item,
                    action.key,
                    onChanged,
                  );
                },
              ),
          ],
        ),
      ),
    ),
  );
}

List<_Action> _actionsFor(
  String module,
  Map<String, dynamic> item,
) => switch (module) {
  'Usuarios' => [
    const _Action('edit', 'Editar datos', Icons.edit_rounded),
    const _Action('password', 'Restablecer contraseña', Icons.key_rounded),
    _Action(
      'toggle',
      item['activo'] == true ? 'Desactivar cuenta' : 'Reactivar cuenta',
      item['activo'] == true
          ? Icons.person_off_rounded
          : Icons.person_add_alt_1_rounded,
    ),
    if (item['rol'] != 'SUPERADMIN')
      const _Action(
        'delete',
        'Eliminar usuario',
        Icons.delete_outline_rounded,
        destructive: true,
      ),
  ],
  'Membresías' || 'Roles por plan' => [
    const _Action('edit_plan', 'Editar plan y límites', Icons.edit_rounded),
    const _Action(
      'roles',
      'Configurar roles habilitados',
      Icons.admin_panel_settings_rounded,
    ),
    _Action(
      'toggle_plan',
      item['activo'] == true ? 'Desactivar plan' : 'Activar plan',
      Icons.power_settings_new_rounded,
    ),
    const _Action(
      'delete_plan',
      'Eliminar plan',
      Icons.delete_outline_rounded,
      destructive: true,
    ),
  ],
  'Licencias' => [
    const _Action('renew', 'Renovar licencia', Icons.autorenew_rounded),
    if (item['estado'] == 'SUSPENDIDO')
      const _Action(
        'reactivate_license',
        'Reactivar licencia',
        Icons.play_circle_outline_rounded,
      )
    else
      const _Action(
        'suspend_license',
        'Suspender licencia',
        Icons.pause_circle_outline_rounded,
        destructive: true,
      ),
    const _Action('license_history', 'Ver historial', Icons.history_rounded),
  ],
  'Facturación' => [
    const _Action('voucher', 'Ver voucher', Icons.image_rounded),
    if (item['estado'] == 'EN_REVISION' || item['estado'] == 'PENDIENTE') ...[
      const _Action(
        'approve_payment',
        'Aprobar pago',
        Icons.check_circle_outline_rounded,
      ),
      const _Action(
        'reject_payment',
        'Rechazar pago',
        Icons.cancel_outlined,
        destructive: true,
      ),
    ],
  ],
  'Respaldos' => [
    if (item['estado'] == 'COMPLETADO') ...[
      const _Action(
        'verify_backup',
        'Verificar integridad',
        Icons.verified_rounded,
      ),
      const _Action(
        'download_backup',
        'Obtener enlace de descarga',
        Icons.download_rounded,
      ),
      const _Action(
        'restore_backup',
        'Restaurar sin borrar datos actuales',
        Icons.settings_backup_restore_rounded,
      ),
    ],
    const _Action(
      'delete_backup',
      'Eliminar respaldo',
      Icons.delete_outline_rounded,
      destructive: true,
    ),
  ],
  _ => const [],
};

Future<void> _execute(
  BuildContext context,
  WidgetRef ref,
  String module,
  Map<String, dynamic> item,
  String action,
  VoidCallback onChanged,
) async {
  try {
    final client = await ref.read(apiClientProvider.future);
    final api = SuperAdminRepository(client);
    final id = item['id'].toString();
    switch (action) {
      case 'edit':
        final values = await _userForm(context, item);
        if (values == null) return;
        await api.patch('usuarios/$id', values);
        break;
      case 'password':
        final result = await api.post('usuarios/$id/restablecer-password');
        if (context.mounted)
          await _showValue(
            context,
            'Contraseña temporal',
            result['password']?.toString() ??
                result['data']?['password']?.toString() ??
                'Generada correctamente',
          );
        break;
      case 'toggle':
        if (!await _confirm(
          context,
          item['activo'] == true
              ? '¿Desactivar esta cuenta?'
              : '¿Reactivar esta cuenta?',
        ))
          return;
        await api.patch('usuarios/$id', {'activo': item['activo'] != true});
        break;
      case 'delete':
        if (!await _confirm(
          context,
          'Esta acción elimina el usuario. ¿Continuar?',
        ))
          return;
        await api.delete('usuarios/$id');
        break;
      case 'edit_plan':
        final values = await _planForm(context, item);
        if (values == null) return;
        await api.patch('membresias/planes/$id', values);
        break;
      case 'roles':
        final roles = await _rolesForm(context, item);
        if (roles == null) return;
        await api.patch('membresias/planes/$id', {'rolesHabilitados': roles});
        break;
      case 'toggle_plan':
        if (!await _confirm(context, '¿Cambiar el estado de este plan?'))
          return;
        await api.patch('membresias/planes/$id/toggle');
        break;
      case 'delete_plan':
        if (!await _confirm(
          context,
          'Solo puede eliminarse si ningún colegio lo usa. ¿Continuar?',
        ))
          return;
        await api.delete('membresias/planes/$id');
        break;
      case 'renew':
        final months = await _renewalMonthsPrompt(context);
        if (months == null) return;
        final planId =
            item['planId']?.toString() ??
            (item['plan'] is Map ? item['plan']['id']?.toString() : null);
        await api.post('membresias/renovar/$id', {
          if (planId != null) 'planId': planId,
          'meses': months,
        });
        break;
      case 'suspend_license':
        final reason = await _textPrompt(
          context,
          'Suspender licencia',
          'Motivo obligatorio',
        );
        if (reason == null || reason.trim().isEmpty) return;
        await api.patch('membresias/licencias/$id/suspender', {
          'motivo': reason,
        });
        break;
      case 'reactivate_license':
        if (!await _confirm(context, '¿Reactivar la licencia?')) return;
        await api.patch('membresias/licencias/$id/reactivar');
        break;
      case 'license_history':
        final result = await api.get('membresias/licencias/$id');
        if (context.mounted)
          await _showValue(
            context,
            'Historial de licencia',
            _pretty(result['data']),
          );
        break;
      case 'voucher':
        final result = await api.get('pagos-licencia/$id/voucher-url');
        final url =
            result['url']?.toString() ?? result['data']?['url']?.toString();
        if (context.mounted) await _showRemoteImage(context, 'Voucher', url);
        break;
      case 'approve_payment':
        if (!await _confirm(
          context,
          '¿Aprobar el pago y extender la licencia?',
        ))
          return;
        await api.patch('pagos-licencia/$id/aprobar');
        break;
      case 'reject_payment':
        final reason = await _textPrompt(
          context,
          'Rechazar pago',
          'Motivo del rechazo',
        );
        if (reason == null || reason.trim().isEmpty) return;
        await api.patch('pagos-licencia/$id/rechazar', {'motivo': reason});
        break;
      case 'verify_backup':
        final result = await api.get('backups/$id/verificar');
        if (context.mounted)
          await _showValue(
            context,
            'Verificación',
            _pretty(result['data'] ?? result),
          );
        break;
      case 'download_backup':
        final result = await api.get('backups/$id/descargar');
        if (context.mounted)
          await _showValue(
            context,
            'Enlace temporal',
            result['url']?.toString() ??
                result['data']?['url']?.toString() ??
                'No disponible',
          );
        break;
      case 'restore_backup':
        if (!await _confirm(
          context,
          'La restauración agregará registros faltantes y reactivará datos eliminados, sin borrar ni sobrescribir la información actual. ¿Continuar?',
        ))
          return;
        final result = await api.post('backups/$id/restaurar', {
          'confirmacion': 'RESTAURAR SIN BORRAR',
        });
        if (context.mounted) {
          await _showValue(
            context,
            'Restauración segura completada',
            _pretty(result['data'] ?? result),
          );
        }
        break;
      case 'delete_backup':
        if (!await _confirm(
          context,
          '¿Eliminar este respaldo? Esta acción no se puede deshacer.',
        ))
          return;
        await api.delete('backups/$id');
        break;
    }
    onChanged();
    if (context.mounted)
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Operación completada.')));
  } catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
  }
}

Future<Map<String, dynamic>?> _userForm(
  BuildContext context,
  Map<String, dynamic> item,
) async {
  final names = TextEditingController(text: item['nombres']?.toString() ?? '');
  final surnames = TextEditingController(
    text: item['apellidos']?.toString() ?? '',
  );
  final phone = TextEditingController(text: item['telefono']?.toString() ?? '');
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Editar usuario'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: names,
            decoration: const InputDecoration(labelText: 'Nombres'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: surnames,
            decoration: const InputDecoration(labelText: 'Apellidos'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: phone,
            decoration: const InputDecoration(labelText: 'Teléfono'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            'nombres': names.text.trim(),
            'apellidos': surnames.text.trim(),
            'telefono': phone.text.trim(),
          }),
          child: const Text('Guardar'),
        ),
      ],
    ),
  );
}

Future<Map<String, dynamic>?> _planForm(
  BuildContext context,
  Map<String, dynamic> item, {
  bool creating = false,
}) async {
  final name = TextEditingController(text: item['nombre']?.toString() ?? '');
  final price = TextEditingController(text: item['precio']?.toString() ?? '0');
  final students = TextEditingController(
    text: item['maxEstudiantes']?.toString() ?? '100',
  );
  final users = TextEditingController(
    text: item['maxUsuarios']?.toString() ?? '30',
  );
  final storage = TextEditingController(
    text: item['maxAlmacenamientoGB']?.toString() ?? '5',
  );
  final duration = TextEditingController(
    text: item['duracionDias']?.toString() ?? '30',
  );
  final description = TextEditingController(
    text: item['descripcion']?.toString() ?? '',
  );
  const availableModules = [
    'ESTUDIANTES',
    'PADRES',
    'MATRICULAS',
    'ASISTENCIA',
    'PAGOS',
    'COMUNICADOS',
    'EVENTOS',
    'ENCUESTAS',
    'DOCUMENTOS',
    'QR',
    'CHATBOT',
    'HORARIOS',
    'OBSERVACIONES',
    'PERMISOS',
  ];
  final rawModules = item['modulosActivos'];
  final selectedModules = rawModules is List
      ? rawModules.map((value) => value.toString()).toSet()
      : <String>{};
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: Text(creating ? 'Nuevo plan' : 'Editar plan'),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: price,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Precio'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: description,
                  minLines: 2,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Descripción'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: students,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Máximo estudiantes',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: users,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Máximo usuarios',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: storage,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Almacenamiento (GB)',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: duration,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Duración (días)',
                  ),
                ),
                const SizedBox(height: 18),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Módulos incluidos',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    for (final module in availableModules)
                      FilterChip(
                        label: Text(module.replaceAll('_', ' ')),
                        selected: selectedModules.contains(module),
                        onSelected: (selected) => setDialogState(() {
                          if (selected) {
                            selectedModules.add(module);
                          } else {
                            selectedModules.remove(module);
                          }
                        }),
                      ),
                  ],
                ),
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
            onPressed: () => Navigator.pop(context, {
              'nombre': name.text.trim(),
              'descripcion': description.text.trim(),
              'precio': double.tryParse(price.text) ?? 0,
              'maxEstudiantes': int.tryParse(students.text) ?? 100,
              'maxUsuarios': int.tryParse(users.text) ?? 30,
              'maxAlmacenamientoGB': double.tryParse(storage.text) ?? 5,
              'duracionDias': int.tryParse(duration.text) ?? 30,
              'modulosActivos': selectedModules.toList(),
              if (creating) 'rolesHabilitados': <String>[],
            }),
            child: const Text('Guardar'),
          ),
        ],
      ),
    ),
  );
}

Future<void> _showRemoteImage(
  BuildContext context,
  String title,
  String? url,
) => showDialog<void>(
  context: context,
  builder: (context) => Dialog(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 520, maxHeight: 720),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  tooltip: 'Cerrar',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Flexible(
              child: url == null || url.isEmpty
                  ? const Center(child: Text('El archivo no está disponible.'))
                  : InteractiveViewer(
                      minScale: .8,
                      maxScale: 4,
                      child: Image.network(
                        url,
                        fit: BoxFit.contain,
                        errorBuilder: (_, _, _) => const Center(
                          child: Text(
                            'No fue posible cargar el archivo. Inténtalo nuevamente.',
                          ),
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    ),
  ),
);

Future<List<String>?> _rolesForm(
  BuildContext context,
  Map<String, dynamic> item,
) async {
  const all = [
    'DIRECTOR',
    'SECRETARIA',
    'DOCENTE',
    'AUXILIAR',
    'PSICOLOGO',
    'COORDINADOR',
    'TUTOR',
    'CONTADOR',
    'ENFERMERIA',
  ];
  final rawRoles = item['rolesHabilitados'];
  final selected = rawRoles is List
      ? rawRoles.map((role) => role.toString()).toSet()
      : <String>{};
  return showDialog<List<String>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Roles habilitados'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView(
            shrinkWrap: true,
            children: [
              for (final role in all)
                CheckboxListTile(
                  value: selected.contains(role),
                  title: Text(role),
                  onChanged: (value) => setState(
                    () => value == true
                        ? selected.add(role)
                        : selected.remove(role),
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, selected.toList()),
            child: const Text('Guardar'),
          ),
        ],
      ),
    ),
  );
}

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

Future<String?> _textPrompt(
  BuildContext context,
  String title,
  String label,
) async {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        maxLines: 3,
        decoration: InputDecoration(labelText: label),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text),
          child: const Text('Continuar'),
        ),
      ],
    ),
  );
}

Future<int?> _numberPrompt(
  BuildContext context,
  String title,
  String label,
  int initial,
) async {
  final controller = TextEditingController(text: '$initial');
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        decoration: InputDecoration(labelText: label),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text),
          child: const Text('Continuar'),
        ),
      ],
    ),
  );
  return result == null ? null : int.tryParse(result);
}

Future<int?> _renewalMonthsPrompt(BuildContext context) async {
  var selected = 12;
  return showDialog<int>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: const Text('Renovar licencia'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Selecciona el periodo que se agregará desde la fecha de vencimiento vigente.',
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<int>(
              initialValue: selected,
              decoration: const InputDecoration(labelText: 'Periodo'),
              items: const [1, 3, 6, 12, 24]
                  .map(
                    (months) => DropdownMenuItem(
                      value: months,
                      child: Text(months == 1 ? '1 mes' : '$months meses'),
                    ),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => selected = value ?? selected),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, selected),
            child: const Text('Renovar'),
          ),
        ],
      ),
    ),
  );
}

Future<void> _showValue(BuildContext context, String title, String value) =>
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SelectableText(value),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );

String _title(Map<String, dynamic> item, String module) {
  final explicit = item['nombre']?.toString() ?? item['titulo']?.toString();
  if (explicit != null && explicit.trim().isNotEmpty) return explicit;
  final person = '${item['nombres'] ?? ''} ${item['apellidos'] ?? ''}'.trim();
  return person.isNotEmpty ? person : module;
}

String _pretty(dynamic value) => value is List
    ? value.map(_pretty).join('\n')
    : value is Map
    ? value.entries.map((e) => '${e.key}: ${_pretty(e.value)}').join('\n')
    : value?.toString() ?? '—';

class _Action {
  const _Action(this.key, this.label, this.icon, {this.destructive = false});
  final String key;
  final String label;
  final IconData icon;
  final bool destructive;
}
