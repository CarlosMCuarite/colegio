import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../data/school_repository.dart';

const _schoolThemes = <({String name, Color primary, Color secondary})>[
  (name: 'Azul', primary: Color(0xFF2563EB), secondary: Color(0xFF16A8E4)),
  (name: 'Rojo', primary: Color(0xFFD34242), secondary: Color(0xFFF06A62)),
  (name: 'Verde', primary: Color(0xFF168A55), secondary: Color(0xFF35B979)),
  (name: 'Amarillo', primary: Color(0xFFD99000), secondary: Color(0xFFF2B72B)),
];

class SchoolFormScreen extends ConsumerStatefulWidget {
  const SchoolFormScreen({super.key, this.school});
  final Map<String, dynamic>? school;

  @override
  ConsumerState<SchoolFormScreen> createState() => _SchoolFormScreenState();
}

class _SchoolFormScreenState extends ConsumerState<SchoolFormScreen> {
  final _form = GlobalKey<FormState>();
  late final Map<String, TextEditingController> fields;
  bool saving = false;
  bool loadingPlans = true;
  List<Map<String, dynamic>> plans = const [];
  String? selectedPlanId;
  late Color selectedPrimary;
  late Color selectedSecondary;

  @override
  void initState() {
    super.initState();
    final data = widget.school ?? const <String, dynamic>{};
    fields = {
      for (final key in [
        'nombre',
        'nombreCorto',
        'ruc',
        'email',
        'telefono',
        'direccion',
        'distrito',
        'provincia',
        'departamento',
        'slug',
      ])
        key: TextEditingController(text: data[key]?.toString() ?? ''),
    };
    final plan = data['plan'];
    selectedPrimary =
        _colorFromHex(data['colorPrimario']?.toString()) ??
        _schoolThemes.first.primary;
    selectedSecondary =
        _colorFromHex(data['colorSecundario']?.toString()) ??
        _schoolThemes.first.secondary;
    selectedPlanId =
        data['planId']?.toString() ??
        (plan is Map<String, dynamic> ? plan['id']?.toString() : null);
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    try {
      final client = await ref.read(apiClientProvider.future);
      plans = await SchoolRepository(client).plans();
      if (selectedPlanId == null && plans.isNotEmpty) {
        selectedPlanId = plans.first['id']?.toString();
      }
    } catch (_) {
      plans = const [];
    } finally {
      if (mounted) setState(() => loadingPlans = false);
    }
  }

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.school == null ? 'Nuevo colegio' : 'Editar colegio'),
    ),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
        children: [
          _field('nombre', 'Nombre institucional', required: true),
          _field('nombreCorto', 'Nombre corto'),
          _field('ruc', 'RUC'),
          _field(
            'email',
            'Correo institucional',
            keyboard: TextInputType.emailAddress,
          ),
          _field('telefono', 'Teléfono', keyboard: TextInputType.phone),
          _field('direccion', 'Dirección'),
          _field('distrito', 'Distrito'),
          _field('provincia', 'Provincia'),
          _field('departamento', 'Departamento'),
          _field('slug', 'Identificador web (slug)'),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: DropdownButtonFormField<String>(
              initialValue: loadingPlans ? null : selectedPlanId,
              decoration: const InputDecoration(
                labelText: 'Plan de membresía',
                prefixIcon: Icon(Icons.workspace_premium_rounded),
              ),
              items: [
                for (final plan in plans.where(
                  (item) => item['activo'] != false,
                ))
                  DropdownMenuItem(
                    value: plan['id']?.toString(),
                    child: Text(
                      '${plan['nombre'] ?? 'Plan'} · S/ ${plan['precio'] ?? 0}',
                    ),
                  ),
              ],
              onChanged: loadingPlans
                  ? null
                  : (value) => setState(() => selectedPlanId = value),
              validator: (value) =>
                  value == null ? 'Selecciona un plan.' : null,
            ),
          ),
          Text(
            'Identidad visual',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 6),
          const Text(
            'La web y el aplicativo usarán automáticamente esta paleta.',
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final theme in _schoolThemes)
                ChoiceChip(
                  avatar: CircleAvatar(backgroundColor: theme.primary),
                  label: Text(theme.name),
                  selected: selectedPrimary == theme.primary,
                  onSelected: (_) => setState(() {
                    selectedPrimary = theme.primary;
                    selectedSecondary = theme.secondary;
                  }),
                ),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: saving ? null : _save,
            child: saving
                ? const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Guardar cambios'),
          ),
        ],
      ),
    ),
  );

  Widget _field(
    String key,
    String label, {
    bool required = false,
    TextInputType? keyboard,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      controller: fields[key],
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label),
      validator: required
          ? (value) => value == null || value.trim().length < 2
                ? 'Este campo es obligatorio.'
                : null
          : null,
    ),
  );

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => saving = true);
    final values = <String, dynamic>{
      for (final entry in fields.entries)
        if (entry.value.text.trim().isNotEmpty)
          entry.key: entry.value.text.trim(),
    };
    values['planId'] = selectedPlanId;
    values['colorPrimario'] = _hex(selectedPrimary);
    values['colorSecundario'] = _hex(selectedSecondary);
    try {
      final client = await ref.read(apiClientProvider.future);
      final repository = SchoolRepository(client);
      if (widget.school == null) {
        if (plans.isEmpty) {
          throw const SchoolException('Primero debes crear un plan activo.');
        }
        values['generarUsuarios'] = true;
        final result = await repository.create(values);
        if (mounted) await _showCredentials(result);
      } else {
        await repository.update(widget.school!['id'].toString(), values);
      }
      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is SchoolException
                  ? error.message
                  : SchoolRepository.errorMessage(error),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _showCredentials(Map<String, dynamic> result) async {
    final raw = result['credenciales'];
    final credentials = raw is List
        ? raw.whereType<Map<String, dynamic>>()
        : const Iterable<Map<String, dynamic>>.empty();
    final errorsRaw = result['erroresGeneracion'];
    final errors = errorsRaw is List
        ? errorsRaw.whereType<Map<String, dynamic>>()
        : const Iterable<Map<String, dynamic>>.empty();
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Colegio creado'),
        content: SingleChildScrollView(
          child: SelectableText(
            [
              if (credentials.isEmpty) 'No se generaron credenciales.',
              for (final credential in credentials)
                '${credential['rol']}\n${credential['email']}\n${credential['password']}',
              if (errors.isNotEmpty) '\nErrores:',
              for (final error in errors) '${error['rol']}: ${error['error']}',
            ].join('\n\n'),
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Guardé las credenciales'),
          ),
        ],
      ),
    );
  }
}

Color? _colorFromHex(String? value) {
  if (value == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value))
    return null;
  return Color(int.parse('FF${value.substring(1)}', radix: 16));
}

String _hex(Color color) =>
    '#${color.toARGB32().toRadixString(16).substring(2).toUpperCase()}';
