import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/design/app_colors.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/superadmin_repository.dart';

final _specialProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, endpoint) async {
      final client = await ref.watch(apiClientProvider.future);
      final response = await SuperAdminRepository(client).get(endpoint);
      final data = response['data'];
      return data is Map<String, dynamic> ? data : <String, dynamic>{};
    });

class SuperAdminMonitorScreen extends ConsumerStatefulWidget {
  const SuperAdminMonitorScreen({super.key});

  @override
  ConsumerState<SuperAdminMonitorScreen> createState() =>
      _SuperAdminMonitorScreenState();
}

class _SuperAdminMonitorScreenState
    extends ConsumerState<SuperAdminMonitorScreen> {
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) {
        ref.invalidate(_specialProvider('dashboard/monitoreo'));
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_specialProvider('dashboard/monitoreo'));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Monitoreo'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            onPressed: () =>
                ref.invalidate(_specialProvider('dashboard/monitoreo')),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: state.when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (error, _) => _Message(
          icon: Icons.cloud_off_rounded,
          text: SuperAdminRepository.message(error),
        ),
        data: (data) {
          final db = _map(data['baseDatos']);
          final storage = _map(data['almacenamiento']);
          final server = _map(data['servidor']);
          final backups = _map(data['backups']);
          final day = _map(backups['ultimas24h']);
          final week = _map(backups['ultimos7d']);
          final users = _map(data['usuarios']);
          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(_specialProvider('dashboard/monitoreo').future),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _HealthHero(ok: db['ok'] == true, latency: db['latenciaMs']),
                const SizedBox(height: 10),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _LivePulse(),
                    SizedBox(width: 8),
                    Text('Actualización automática cada 5 segundos'),
                  ],
                ),
                const SizedBox(height: 18),
                _section(context, 'Servidor', [
                  _datum('Tiempo activo', _duration(server['uptimeSegundos'])),
                  _datum(
                    'Memoria',
                    '${server['memoriaUsadaMB'] ?? 0} / ${server['memoriaTotalMB'] ?? 0} MB',
                  ),
                  _datum('Node', server['nodeVersion']?.toString() ?? '—'),
                ]),
                _CapacityCard(
                  title: 'Base de datos Supabase',
                  icon: Icons.storage_rounded,
                  used: (db['usadoMB'] as num?)?.toDouble() ?? 0,
                  limit: (db['limiteMB'] as num?)?.toDouble() ?? 500,
                  percentage: (db['porcentaje'] as num?)?.toInt() ?? 0,
                ),
                const SizedBox(height: 14),
                _CapacityCard(
                  title: 'Almacenamiento de archivos',
                  icon: Icons.cloud_queue_rounded,
                  used: (storage['usadoMB'] as num?)?.toDouble() ?? 0,
                  limit: (storage['limiteMB'] as num?)?.toDouble() ?? 1024,
                  percentage: (storage['porcentaje'] as num?)?.toInt() ?? 0,
                  note: storage['alcance']?.toString(),
                ),
                const SizedBox(height: 18),
                _section(context, 'Respaldos', [
                  _datum('Éxito 24 horas', '${day['tasaExito'] ?? '—'}%'),
                  _datum('Fallidos 24 horas', '${day['fallidos'] ?? 0}'),
                  _datum('Éxito 7 días', '${week['tasaExito'] ?? '—'}%'),
                ]),
                _section(context, 'Actividad', [
                  _datum(
                    'Usuarios · 15 min',
                    '${users['activosUltimos15min'] ?? 0}',
                  ),
                  _datum(
                    'Usuarios · 1 hora',
                    '${users['activosUltimaHora'] ?? 0}',
                  ),
                  _datum(
                    'Colegios suspendidos',
                    '${data['colegiosSuspendidos'] ?? 0}',
                  ),
                ]),
                _RecentAccesses(items: _list(users['ultimosAccesos'])),
                _RecentActivity(items: _list(data['actividadReciente'])),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _LivePulse extends StatefulWidget {
  const _LivePulse();

  @override
  State<_LivePulse> createState() => _LivePulseState();
}

class _LivePulseState extends State<_LivePulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return const Icon(Icons.circle, size: 10, color: Color(0xFF168A55));
    }
    return FadeTransition(
      opacity: Tween<double>(begin: .35, end: 1).animate(_controller),
      child: const Icon(Icons.circle, size: 10, color: Color(0xFF168A55)),
    );
  }
}

class PlatformConfigurationScreen extends ConsumerStatefulWidget {
  const PlatformConfigurationScreen({super.key});

  @override
  ConsumerState<PlatformConfigurationScreen> createState() =>
      _PlatformConfigurationScreenState();
}

class _PlatformConfigurationScreenState
    extends ConsumerState<PlatformConfigurationScreen> {
  final _controllers = <String, TextEditingController>{};
  bool _saving = false;

  static const fields = <(String, String, IconData)>[
    ('yapeNumero', 'Número Yape', Icons.phone_android_rounded),
    ('yapeTitular', 'Titular Yape', Icons.person_rounded),
    ('plinNumero', 'Número Plin', Icons.phone_android_rounded),
    ('plinTitular', 'Titular Plin', Icons.person_rounded),
    ('bancoNombre', 'Banco', Icons.account_balance_rounded),
    ('cuentaBancaria', 'Número de cuenta', Icons.numbers_rounded),
    ('cuentaBancariaCCI', 'CCI', Icons.numbers_rounded),
  ];

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _hydrate(Map<String, dynamic> data) {
    for (final field in fields) {
      _controllers.putIfAbsent(
        field.$1,
        () => TextEditingController(text: data[field.$1]?.toString() ?? ''),
      );
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final client = await ref.read(apiClientProvider.future);
      await SuperAdminRepository(client).patch('plataforma/config', {
        for (final entry in _controllers.entries)
          entry.key: entry.value.text.trim(),
      });
      ref.invalidate(_specialProvider('plataforma/config'));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Configuración guardada.')),
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

  Future<void> _uploadQr(String type) async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 1600,
    );
    if (image == null) return;
    setState(() => _saving = true);
    try {
      final client = await ref.read(apiClientProvider.future);
      await client.dio.post<Map<String, dynamic>>(
        'plataforma/config/qr',
        data: FormData.fromMap({
          'tipo': type,
          'imagen': await MultipartFile.fromFile(
            image.path,
            filename: image.name,
          ),
        }),
        options: Options(contentType: 'multipart/form-data'),
      );
      ref.invalidate(_specialProvider('plataforma/config'));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Código QR actualizado.')));
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
  Widget build(BuildContext context) {
    final state = ref.watch(_specialProvider('plataforma/config'));
    return Scaffold(
      appBar: AppBar(title: const Text('Configuración global')),
      body: state.when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (error, _) => _Message(
          icon: Icons.warning_amber_rounded,
          text: SuperAdminRepository.message(error),
        ),
        data: (data) {
          _hydrate(data);
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F4FF),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.payments_rounded, color: SigeColors.blue),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Estos son los datos que los colegios verán para pagar su suscripción SIGE.',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Text('Códigos QR', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              Row(
                children: [
                  for (final qr in [
                    ('yape', 'Yape', data['yapeQrUrl']),
                    ('plin', 'Plin', data['plinQrUrl']),
                    ('banco', 'Banco', data['bancoQrUrl']),
                  ])
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(18),
                          onTap: _saving ? null : () => _uploadQr(qr.$1),
                          child: Ink(
                            height: 112,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF3F7FC),
                              borderRadius: BorderRadius.circular(18),
                              image:
                                  qr.$3 is String &&
                                      (qr.$3 as String).isNotEmpty
                                  ? DecorationImage(
                                      image: NetworkImage(qr.$3 as String),
                                      fit: BoxFit.cover,
                                    )
                                  : null,
                            ),
                            child:
                                qr.$3 is String && (qr.$3 as String).isNotEmpty
                                ? null
                                : Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(Icons.qr_code_2_rounded),
                                      Text(qr.$2),
                                    ],
                                  ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              for (final field in fields) ...[
                TextField(
                  controller: _controllers[field.$1],
                  keyboardType:
                      field.$1.contains('Numero') || field.$1.contains('cuenta')
                      ? TextInputType.number
                      : TextInputType.text,
                  decoration: InputDecoration(
                    labelText: field.$2,
                    prefixIcon: Icon(field.$3),
                  ),
                ),
                const SizedBox(height: 13),
              ],
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_rounded),
                label: Text(_saving ? 'Guardando…' : 'Guardar cambios'),
              ),
            ],
          );
        },
      ),
    );
  }
}

Widget _section(BuildContext context, String title, List<Widget> children) =>
    Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: SigeColors.line),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );

Widget _datum(String label, String value) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 7),
  child: Row(
    children: [
      Expanded(child: Text(label)),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
    ],
  ),
);

Map<String, dynamic> _map(dynamic value) =>
    value is Map<String, dynamic> ? value : <String, dynamic>{};

List<Map<String, dynamic>> _list(dynamic value) =>
    value is List ? value.whereType<Map<String, dynamic>>().toList() : const [];

String _duration(dynamic seconds) {
  final value = seconds is num ? seconds.toInt() : 0;
  final days = value ~/ 86400;
  final hours = (value % 86400) ~/ 3600;
  return days > 0 ? '$days d $hours h' : '$hours h';
}

class _HealthHero extends StatelessWidget {
  const _HealthHero({required this.ok, required this.latency});
  final bool ok;
  final dynamic latency;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      color: ok ? const Color(0xFFEAF8F1) : const Color(0xFFFFECEA),
      borderRadius: BorderRadius.circular(26),
    ),
    child: Row(
      children: [
        Icon(
          ok ? Icons.verified_rounded : Icons.error_rounded,
          size: 42,
          color: ok ? const Color(0xFF168A55) : const Color(0xFFB42318),
        ),
        const SizedBox(width: 15),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                ok ? 'Sistema operativo' : 'Requiere atención',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              Text('Base de datos · ${latency ?? '—'} ms'),
            ],
          ),
        ),
      ],
    ),
  );
}

class _CapacityCard extends StatelessWidget {
  const _CapacityCard({
    required this.title,
    required this.icon,
    required this.used,
    required this.limit,
    required this.percentage,
    this.note,
  });
  final String title;
  final IconData icon;
  final double used, limit;
  final int percentage;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final color = percentage >= 85
        ? const Color(0xFFB42318)
        : percentage >= 65
        ? const Color(0xFFC07800)
        : SigeColors.blue;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: SigeColors.line),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                '$percentage%',
                style: TextStyle(color: color, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 13),
          LinearProgressIndicator(
            value: (percentage / 100).clamp(0, 1),
            minHeight: 9,
            borderRadius: BorderRadius.circular(9),
            color: color,
            backgroundColor: color.withValues(alpha: .12),
          ),
          const SizedBox(height: 9),
          Text(
            '${used.toStringAsFixed(1)} MB usados de ${limit.toStringAsFixed(0)} MB',
          ),
          if (note != null)
            Text(note!, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 44),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}

class _RecentAccesses extends StatelessWidget {
  const _RecentAccesses({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) => _section(
    context,
    'Accesos recientes',
    items.isEmpty
        ? [const Text('No hay accesos recientes.')]
        : [
            for (final item in items.take(8))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFFE9F2FF),
                  foregroundColor: SigeColors.blue,
                  backgroundImage:
                      item['avatarUrl'] is String &&
                          (item['avatarUrl'] as String).isNotEmpty
                      ? NetworkImage(item['avatarUrl'] as String)
                      : null,
                  child: item['avatarUrl'] == null
                      ? const Icon(Icons.person_outline_rounded)
                      : null,
                ),
                title: Text(
                  '${item['nombres'] ?? ''} ${item['apellidos'] ?? ''}'.trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  '${item['rol'] ?? 'USUARIO'} · ${_map(item['colegio'])['nombre'] ?? 'Plataforma'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
  );
}

class _RecentActivity extends StatelessWidget {
  const _RecentActivity({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) => _section(
    context,
    'Actividad de auditoría',
    items.isEmpty
        ? [const Text('No hay actividad registrada.')]
        : [
            for (final item in items.take(10))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.history_rounded),
                title: Text(
                  '${item['accion'] ?? 'ACTIVIDAD'} · ${item['modulo'] ?? 'SIGE'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  '${_map(item['usuario'])['nombres'] ?? 'Sistema'} · ${_map(item['colegio'])['nombre'] ?? 'Global'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
  );
}
