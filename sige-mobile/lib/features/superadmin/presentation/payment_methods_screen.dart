import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/design/app_colors.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/superadmin_repository.dart';

final _paymentMethodsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      final client = await ref.watch(apiClientProvider.future);
      final response = await SuperAdminRepository(client)
          .get('plataforma/config');
      final data = response['data'];
      final config = data is Map<String, dynamic> ? data : response;
      final methods = config['metodosCobro'];
      return methods is List
          ? methods.whereType<Map<String, dynamic>>().toList()
          : const [];
    });

class PaymentMethodsScreen extends ConsumerWidget {
  const PaymentMethodsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(_paymentMethodsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Datos de cobro')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _editMethod(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nuevo método'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(_paymentMethodsProvider.future),
        child: state.when(
          loading: () =>
              const Center(child: CircularProgressIndicator.adaptive()),
          error: (error, _) => ListView(
            children: [
              const SizedBox(height: 180),
              const Icon(Icons.cloud_off_rounded, size: 48),
              const SizedBox(height: 12),
              Text(
                SuperAdminRepository.message(error),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          data: (items) => ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF102C63), Color(0xFF2563EB)],
                  ),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.account_balance_wallet_rounded,
                      color: Colors.white,
                      size: 34,
                    ),
                    SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        'Administra billeteras, bancos, tarjetas y otros medios visibles para los colegios.',
                        style: TextStyle(color: Colors.white, height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Métodos configurados',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              if (items.isEmpty)
                const _EmptyMethods()
              else
                for (final item in items) ...[
                  _MethodCard(
                    item: item,
                    onEdit: () => _editMethod(context, ref, item),
                    onQr: () => _uploadQr(context, ref, item),
                    onToggle: () => _toggle(context, ref, item),
                    onDelete: () => _delete(context, ref, item),
                    onViewQr: () => _viewQr(context, item),
                  ),
                  const SizedBox(height: 12),
                ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.item,
    required this.onEdit,
    required this.onQr,
    required this.onToggle,
    required this.onDelete,
    required this.onViewQr,
  });
  final Map<String, dynamic> item;
  final VoidCallback onEdit, onQr, onToggle, onDelete, onViewQr;

  @override
  Widget build(BuildContext context) {
    final active = item['activo'] == true;
    final qr = item['qrUrl']?.toString();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: SigeColors.line),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: SigeColors.blue.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  _methodIcon(item['tipo']?.toString()),
                  color: SigeColors.blue,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['nombre']?.toString() ?? 'Método de cobro',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      '${item['tipo'] ?? 'OTRO'} · ${active ? 'Activo' : 'Oculto'}',
                    ),
                  ],
                ),
              ),
              Switch(value: active, onChanged: (_) => onToggle()),
            ],
          ),
          if ((item['titular']?.toString() ?? '').isNotEmpty ||
              (item['numeroCuenta']?.toString() ?? '').isNotEmpty) ...[
            const Divider(height: 26),
            if ((item['titular']?.toString() ?? '').isNotEmpty)
              _line(
                Icons.person_outline_rounded,
                'Titular',
                item['titular'].toString(),
              ),
            if ((item['numeroCuenta']?.toString() ?? '').isNotEmpty)
              _line(
                Icons.numbers_rounded,
                'Cuenta o número',
                item['numeroCuenta'].toString(),
              ),
            if ((item['cci']?.toString() ?? '').isNotEmpty)
              _line(
                Icons.account_balance_rounded,
                'CCI',
                item['cci'].toString(),
              ),
          ],
          if (qr != null && qr.isNotEmpty) ...[
            const SizedBox(height: 10),
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: onViewQr,
              child: Ink(
                height: 124,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F7FC),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Image.network(
                    qr,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const Center(
                      child: Text('No se pudo mostrar el QR actual.'),
                    ),
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onQr,
                  icon: Icon(
                    qr == null || qr.isEmpty
                        ? Icons.qr_code_2_rounded
                        : Icons.image_rounded,
                  ),
                  label: Text(
                    qr == null || qr.isEmpty ? 'Agregar QR' : 'Cambiar QR',
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                tooltip: 'Editar',
                onPressed: onEdit,
                icon: const Icon(Icons.edit_rounded),
              ),
              const SizedBox(width: 4),
              IconButton.filledTonal(
                tooltip: 'Eliminar',
                onPressed: onDelete,
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  color: Colors.red,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

Future<void> _viewQr(BuildContext context, Map<String, dynamic> item) async {
  final url = item['qrUrl']?.toString();
  if (url == null || url.isEmpty) return;
  await showDialog<void>(
    context: context,
    builder: (context) => Dialog(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item['nombre']?.toString() ?? 'Código QR',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 420),
              child: InteractiveViewer(
                child: Image.network(url, fit: BoxFit.contain),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

Widget _line(IconData icon, String label, String value) => Padding(
  padding: const EdgeInsets.only(bottom: 7),
  child: Row(
    children: [
      Icon(icon, size: 18, color: SigeColors.slate),
      const SizedBox(width: 8),
      Text('$label: '),
      Expanded(
        child: Text(
          value,
          textAlign: TextAlign.end,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    ],
  ),
);

IconData _methodIcon(String? type) => switch (type) {
  'BILLETERA' => Icons.phone_android_rounded,
  'BANCO' => Icons.account_balance_rounded,
  'TARJETA' => Icons.credit_card_rounded,
  _ => Icons.payments_outlined,
};

class _EmptyMethods extends StatelessWidget {
  const _EmptyMethods();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(28),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: SigeColors.line),
      borderRadius: BorderRadius.circular(22),
    ),
    child: const Column(
      children: [
        Icon(
          Icons.account_balance_wallet_outlined,
          size: 42,
          color: SigeColors.slate,
        ),
        SizedBox(height: 10),
        Text('Aún no hay métodos de cobro.'),
        Text(
          'Agrega Yape, Plin, una cuenta bancaria, tarjeta u otra alternativa.',
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

Future<void> _editMethod(
  BuildContext context,
  WidgetRef ref, [
  Map<String, dynamic>? item,
]) async {
  final name = TextEditingController(text: item?['nombre']?.toString() ?? '');
  final holder = TextEditingController(
    text: item?['titular']?.toString() ?? '',
  );
  final number = TextEditingController(
    text: item?['numeroCuenta']?.toString() ?? '',
  );
  final cci = TextEditingController(text: item?['cci']?.toString() ?? '');
  var type = item?['tipo']?.toString() ?? 'BILLETERA';
  final values = await showDialog<Map<String, dynamic>>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => AlertDialog(
        title: Text(item == null ? 'Nuevo método de cobro' : 'Editar método'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: const ['BILLETERA', 'BANCO', 'TARJETA', 'OTRO']
                    .map(
                      (value) =>
                          DropdownMenuItem(value: value, child: Text(value)),
                    )
                    .toList(),
                onChanged: (value) => setState(() => type = value ?? type),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Nombre *'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: holder,
                decoration: const InputDecoration(labelText: 'Titular'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: number,
                decoration: const InputDecoration(
                  labelText: 'Número, cuenta o tarjeta',
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: cci,
                decoration: const InputDecoration(labelText: 'CCI (opcional)'),
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
            onPressed: () {
              if (name.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Escribe un nombre para el método.'),
                  ),
                );
                return;
              }
              Navigator.pop(context, {
                'nombre': name.text.trim(),
                'tipo': type,
                'titular': holder.text.trim(),
                'numeroCuenta': number.text.trim(),
                'cci': cci.text.trim(),
                'activo': item?['activo'] ?? true,
                'orden': item?['orden'] ?? 0,
              });
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    ),
  );
  if (values == null || !context.mounted) return;
  try {
    final api = SuperAdminRepository(await ref.read(apiClientProvider.future));
    if (item == null) {
      await api.post('plataforma/config/metodos', values);
    } else {
      await api.patch('plataforma/config/metodos/${item['id']}', values);
    }
    ref.invalidate(_paymentMethodsProvider);
  } catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
  }
}

Future<void> _toggle(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> item,
) async {
  try {
    final api = SuperAdminRepository(await ref.read(apiClientProvider.future));
    await api.patch('plataforma/config/metodos/${item['id']}', {
      'activo': item['activo'] != true,
    });
    ref.invalidate(_paymentMethodsProvider);
  } catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
  }
}

Future<void> _delete(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> item,
) async {
  final ok =
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Eliminar método'),
          content: Text('¿Eliminar ${item['nombre'] ?? 'este método'}?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Eliminar'),
            ),
          ],
        ),
      ) ??
      false;
  if (!ok || !context.mounted) return;
  try {
    final api = SuperAdminRepository(await ref.read(apiClientProvider.future));
    await api.delete('plataforma/config/metodos/${item['id']}');
    ref.invalidate(_paymentMethodsProvider);
  } catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
  }
}

Future<void> _uploadQr(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> item,
) async {
  final image = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    imageQuality: 88,
    maxWidth: 1600,
  );
  if (image == null || !context.mounted) return;
  try {
    final client = await ref.read(apiClientProvider.future);
    await client.dio.post<Map<String, dynamic>>(
      'plataforma/config/metodos/${item['id']}/qr',
      data: FormData.fromMap({
        'imagen': await MultipartFile.fromFile(
          image.path,
          filename: image.name,
        ),
      }),
      options: Options(contentType: 'multipart/form-data'),
    );
    ref.invalidate(_paymentMethodsProvider);
  } catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SuperAdminRepository.message(error))),
      );
  }
}
