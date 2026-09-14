import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../auth/domain/user.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/superadmin_repository.dart';

class ProfileDetailsScreen extends ConsumerStatefulWidget {
  const ProfileDetailsScreen({super.key, required this.user});
  final SigeUser user;

  @override
  ConsumerState<ProfileDetailsScreen> createState() =>
      _ProfileDetailsScreenState();
}

class _ProfileDetailsScreenState extends ConsumerState<ProfileDetailsScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _names;
  late final TextEditingController _surnames;
  final _phone = TextEditingController();
  final _dni = TextEditingController();
  final _address = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _names = TextEditingController(text: widget.user.firstName);
    _surnames = TextEditingController(text: widget.user.lastName);
    _load();
  }

  Future<void> _load() async {
    try {
      final client = await ref.read(apiClientProvider.future);
      final response = await SuperAdminRepository(client).get('auth/me');
      final data = response['data'];
      if (data is Map<String, dynamic>) {
        _phone.text = data['telefono']?.toString() ?? '';
        _dni.text = data['dni']?.toString() ?? '';
        _address.text = data['direccion']?.toString() ?? '';
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final client = await ref.read(apiClientProvider.future);
      await SuperAdminRepository(client).patch('usuarios/${widget.user.id}', {
        'nombres': _names.text.trim(),
        'apellidos': _surnames.text.trim(),
        'telefono': _phone.text.trim(),
        'dni': _dni.text.trim(),
        'direccion': _address.text.trim(),
      });
      await ref.read(authControllerProvider.notifier).bootstrap();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Perfil actualizado.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(SuperAdminRepository.message(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _uploadAvatar() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 1200,
    );
    if (image == null) return;
    setState(() => _saving = true);
    try {
      final client = await ref.read(apiClientProvider.future);
      await client.dio.post<Map<String, dynamic>>(
        'usuarios/${widget.user.id}/avatar',
        data: FormData.fromMap({
          'avatar': await MultipartFile.fromFile(
            image.path,
            filename: image.name,
          ),
        }),
        options: Options(contentType: 'multipart/form-data'),
      );
      await ref.read(authControllerProvider.notifier).bootstrap();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto de perfil actualizada.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(SuperAdminRepository.message(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _names.dispose();
    _surnames.dispose();
    _phone.dispose();
    _dni.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Datos personales')),
    body: _loading
        ? const Center(child: CircularProgressIndicator.adaptive())
        : Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Center(
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : _uploadAvatar,
                    icon: const Icon(Icons.add_a_photo_outlined),
                    label: const Text('Cambiar foto de perfil'),
                  ),
                ),
                const SizedBox(height: 20),
                _field(_names, 'Nombres', Icons.person_rounded, required: true),
                _field(
                  _surnames,
                  'Apellidos',
                  Icons.person_outline_rounded,
                  required: true,
                ),
                _field(
                  _phone,
                  'Teléfono',
                  Icons.phone_rounded,
                  keyboard: TextInputType.phone,
                ),
                _field(
                  _dni,
                  'DNI',
                  Icons.badge_outlined,
                  keyboard: TextInputType.number,
                ),
                _field(_address, 'Dirección', Icons.home_outlined),
                TextFormField(
                  initialValue: widget.user.email,
                  readOnly: true,
                  decoration: const InputDecoration(
                    labelText: 'Correo',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: const Icon(Icons.save_rounded),
                  label: Text(_saving ? 'Guardando…' : 'Guardar cambios'),
                ),
              ],
            ),
          ),
  );

  Widget _field(
    TextEditingController controller,
    String label,
    IconData icon, {
    bool required = false,
    TextInputType? keyboard,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboard,
        validator: required
            ? (value) =>
                  (value ?? '').trim().length < 2 ? 'Campo requerido' : null
            : null,
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      ),
    );
  }
}

class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});

  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _saving = false;
  bool _obscure = true;

  bool get _hasLength => _next.text.length >= 8;
  bool get _hasUpper => RegExp(r'[A-Z]').hasMatch(_next.text);
  bool get _hasLower => RegExp(r'[a-z]').hasMatch(_next.text);
  bool get _hasNumber => RegExp(r'[0-9]').hasMatch(_next.text);
  bool get _hasSymbol => RegExp(r'[^A-Za-z0-9]').hasMatch(_next.text);
  bool get _matches => _next.text.isNotEmpty && _next.text == _repeat.text;
  bool get _valid =>
      _current.text.isNotEmpty &&
      _hasLength &&
      _hasUpper &&
      _hasLower &&
      _hasNumber &&
      _hasSymbol &&
      _matches;

  Future<void> _change() async {
    if (!_valid) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Completa todos los requisitos de seguridad.'),
        ),
      );
      return;
    }
    if (_next.text != _repeat.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Las contraseñas nuevas no coinciden.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final client = await ref.read(apiClientProvider.future);
      await SuperAdminRepository(client).post('auth/cambiar-password', {
        'passwordActual': _current.text,
        'password': _next.text,
      });
      await ref.read(authControllerProvider.notifier).logout();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(SuperAdminRepository.message(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Seguridad')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Al cambiarla se cerrarán todas tus sesiones por seguridad.',
        ),
        const SizedBox(height: 20),
        for (final entry in [
          (_current, 'Contraseña actual'),
          (_next, 'Nueva contraseña'),
          (_repeat, 'Repetir contraseña'),
        ]) ...[
          TextField(
            controller: entry.$1,
            onChanged: (_) => setState(() {}),
            obscureText: _obscure,
            decoration: InputDecoration(
              labelText: entry.$2,
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                onPressed: () => setState(() => _obscure = !_obscure),
                icon: Icon(
                  _obscure
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              ),
            ),
          ),
          const SizedBox(height: 13),
        ],
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF3F7FC),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tu nueva contraseña debe incluir',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 10),
              _PasswordRule(label: 'Al menos 8 caracteres', valid: _hasLength),
              _PasswordRule(label: 'Una letra mayúscula', valid: _hasUpper),
              _PasswordRule(label: 'Una letra minúscula', valid: _hasLower),
              _PasswordRule(label: 'Un número', valid: _hasNumber),
              _PasswordRule(label: 'Un símbolo', valid: _hasSymbol),
              _PasswordRule(
                label: 'Las contraseñas coinciden',
                valid: _matches,
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: _saving || !_valid ? null : _change,
          icon: const Icon(Icons.key_rounded),
          label: Text(_saving ? 'Actualizando…' : 'Cambiar contraseña'),
        ),
      ],
    ),
  );
}

class _PasswordRule extends StatelessWidget {
  const _PasswordRule({required this.label, required this.valid});
  final String label;
  final bool valid;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Icon(
          valid
              ? Icons.check_circle_rounded
              : Icons.radio_button_unchecked_rounded,
          size: 19,
          color: valid ? const Color(0xFF168A55) : const Color(0xFF8090A7),
        ),
        const SizedBox(width: 9),
        Text(
          label,
          style: TextStyle(
            color: valid ? const Color(0xFF116A43) : null,
            fontWeight: valid ? FontWeight.w700 : FontWeight.w400,
          ),
        ),
      ],
    ),
  );
}
