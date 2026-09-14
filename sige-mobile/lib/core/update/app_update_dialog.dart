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
          icon: const Icon(Icons.system_update_alt_rounded, size: 40),
          title: Text('SIGE ${release.version} disponible'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(release.notes),
              if (release.requiredUpdate)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text(
                    'Esta actualización es necesaria para continuar.',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              if (loading)
                Padding(
                  padding: const EdgeInsets.only(top: 18),
                  child: LinearProgressIndicator(value: progress),
                ),
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
              label: Text(loading ? 'Descargando…' : 'Actualizar'),
            ),
          ],
        ),
      ),
    ),
  );
}
