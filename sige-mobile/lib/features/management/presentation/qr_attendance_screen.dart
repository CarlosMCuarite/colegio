import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../superadmin/data/superadmin_repository.dart';

class QrAttendanceScreen extends ConsumerStatefulWidget {
  const QrAttendanceScreen({super.key});

  @override
  ConsumerState<QrAttendanceScreen> createState() => _QrAttendanceScreenState();
}

class _QrAttendanceScreenState extends ConsumerState<QrAttendanceScreen> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );
  bool _sending = false;
  String? _lastCode;
  DateTime? _lastRead;

  Future<void> _register(String code) async {
    final now = DateTime.now();
    if (_sending ||
        (_lastCode == code &&
            _lastRead != null &&
            now.difference(_lastRead!) < const Duration(seconds: 8))) {
      return;
    }
    _sending = true;
    _lastCode = code;
    _lastRead = now;
    setState(() {});
    try {
      final client = await ref.read(apiClientProvider.future);
      final response = await SuperAdminRepository(client)
          .post('qr/escanear', {'codigoQR': code});
      final data = response['data'];
      final student = data is Map ? data['estudiante'] : null;
      final name = student is Map
          ? '${student['nombres'] ?? ''} ${student['apellidos'] ?? ''}'.trim()
          : 'Estudiante registrado';
      if (mounted) {
        await showModalBottomSheet<void>(
          context: context,
          showDragHandle: true,
          builder: (context) => Padding(
            padding: const EdgeInsets.fromLTRB(24, 4, 24, 30),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle_rounded,
                  color: Theme.of(context).colorScheme.primary,
                  size: 54,
                ),
                const SizedBox(height: 12),
                Text(name, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 5),
                const Text('Asistencia registrada correctamente.'),
              ],
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(SuperAdminRepository.message(error))),
        );
      }
    } finally {
      _sending = false;
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Scaffold(
      appBar: AppBar(title: const Text('QR Asistencia')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Text(
                'Encuadra el QR del carnet',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 6),
              const Text(
                'La cámara detectará el código automáticamente; no necesitas tomar una foto.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      MobileScanner(
                        controller: _controller,
                        onDetect: (capture) {
                          final code = capture.barcodes.firstOrNull?.rawValue;
                          if (code != null && code.trim().isNotEmpty) {
                            _register(code.trim());
                          }
                        },
                      ),
                      Center(
                        child: Container(
                          width: 238,
                          height: 238,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(28),
                            border: Border.all(color: primary, width: 4),
                          ),
                        ),
                      ),
                      if (_sending)
                        ColoredBox(
                          color: Colors.black45,
                          child: Center(
                            child: CircularProgressIndicator(color: primary),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton.filledTonal(
                    tooltip: 'Linterna',
                    onPressed: _controller.toggleTorch,
                    icon: const Icon(Icons.flashlight_on_rounded),
                  ),
                  const SizedBox(width: 14),
                  IconButton.filledTonal(
                    tooltip: 'Cambiar cámara',
                    onPressed: _controller.switchCamera,
                    icon: const Icon(Icons.cameraswitch_rounded),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
