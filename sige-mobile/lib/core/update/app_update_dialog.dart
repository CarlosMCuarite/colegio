import 'package:flutter/material.dart';

import 'app_update_service.dart';

Future<void> showAppUpdate(BuildContext context, AppRelease release) async {
  double progress = 0;
  bool loading = false;
  await showDialog<void>(
    context: context,
    barrierDismissible: !release.requiredUpdate,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setState) => PopScope(
        canPop: !release.requiredUpdate && !loading,
        child: AlertDialog(
          icon: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(
              loading
                  ? Icons.downloading_rounded
                  : Icons.system_update_alt_rounded,
              size: 34,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          title: Text(
            loading ? 'Preparando actualización' : 'Nueva versión disponible',
            textAlign: TextAlign.center,
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SIGE ${release.version} · compilación ${release.build}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              Text(release.notes),
              if (release.requiredUpdate)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text(
                    'Esta actualización es necesaria para continuar.',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              if (loading) ...[
                const SizedBox(height: 20),
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 10,
                  ),
                ),
                const SizedBox(height: 9),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        progress >= 1
                            ? 'Verificando e instalando…'
                            : 'Descargando de forma segura…',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    Text(
                      '${(progress * 100).round()}%',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ],
            ],
          ),
          actions: [
            if (!release.requiredUpdate && !loading)
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Más tarde'),
              ),
            FilledButton.icon(
              onPressed: loading
                  ? null
                  : () async {
                      setState(() => loading = true);
                      try {
                        await AppUpdateService().downloadAndInstall(
                          release,
                          (v) => setState(() => progress = v),
                        );
                      } catch (error) {
                        if (context.mounted) {
                          setState(() => loading = false);
                          ScaffoldMessenger.of(context)
                              .showSnackBar(SnackBar(content: Text('$error')));
                        }
                      }
                    },
              icon: const Icon(Icons.download_rounded),
              label: Text(loading ? 'Actualizando…' : 'Descargar e instalar'),
            ),
          ],
        ),
      ),
    ),
  );
}
