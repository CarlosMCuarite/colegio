import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

import '../config/app_config.dart';

class AppRelease {
  const AppRelease({
    required this.version,
    required this.build,
    required this.notes,
    required this.url,
    required this.sha256,
    required this.requiredUpdate,
  });
  final String version, notes, url, sha256;
  final int build;
  final bool requiredUpdate;
}

class AppUpdateService {
  Future<AppRelease?> check() async {
    final info = await PackageInfo.fromPlatform();
    final response = await Dio().get(
      '${AppConfig.apiBaseUrl}actualizaciones/actual',
      queryParameters: {'version': info.version, 'build': info.buildNumber},
    );
    final raw = response.data['data'];
    if (raw is! Map || raw['disponible'] != true || raw['url'] == null)
      return null;
    return AppRelease(
      version: '${raw['version']}',
      build: raw['build'] as int,
      notes: '${raw['notas']}',
      url: '${raw['url']}',
      sha256: '${raw['sha256']}',
      requiredUpdate: raw['requerida'] == true,
    );
  }

  Future<void> downloadAndInstall(
    AppRelease release,
    void Function(double) onProgress,
  ) async {
    final directory = await getTemporaryDirectory();
    final file = File(
      '${directory.path}/sige-${release.version}-${release.build}.apk',
    );
    await Dio().download(
      release.url,
      file.path,
      onReceiveProgress: (a, b) {
        if (b > 0) onProgress(a / b);
      },
    );
    final digest = sha256.convert(await file.readAsBytes()).toString();
    if (digest.toLowerCase() != release.sha256.toLowerCase()) {
      await file.delete();
      throw const FormatException(
        'La descarga no superó la verificación de seguridad.',
      );
    }
    final result = await OpenFilex.open(
      file.path,
      type: 'application/vnd.android.package-archive',
    );
    if (result.type != ResultType.done)
      throw Exception('Android no pudo abrir el instalador: ${result.message}');
  }
}
