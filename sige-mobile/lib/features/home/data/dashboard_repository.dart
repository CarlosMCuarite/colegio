import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../auth/domain/user.dart';
import '../domain/dashboard_data.dart';

class DashboardRepository {
  const DashboardRepository(this.client);
  final ApiClient client;

  Future<DashboardData> load(SigeUser user) async {
    final endpoint = switch (user.role) {
      'SUPERADMIN' => 'dashboard/superadmin',
      'ADMINISTRADOR' || 'DIRECTOR' || 'SECRETARIA' => 'dashboard/ejecutivo',
      'PADRE' => 'dashboard/padre',
      _ => null,
    };
    if (endpoint == null) {
      return const DashboardData(kind: DashboardKind.staff, data: {});
    }

    final response = await client.dio.get<Map<String, dynamic>>(endpoint);
    final body = response.data;
    final data = body?['data'];
    if (data is! Map<String, dynamic>) {
      throw const DashboardException('SIGE no devolvió un panel válido.');
    }
    return DashboardData(kind: _kindFor(user.role), data: data);
  }

  DashboardKind _kindFor(String role) => switch (role) {
    'SUPERADMIN' => DashboardKind.superAdmin,
    'PADRE' => DashboardKind.family,
    _ => DashboardKind.executive,
  };
}

class DashboardException implements Exception {
  const DashboardException(this.message);
  final String message;

  static DashboardException fromDio(DioException error) {
    final body = error.response?.data;
    if (body is Map<String, dynamic> && body['error'] is String) {
      return DashboardException(body['error'] as String);
    }
    return const DashboardException(
      'No pudimos actualizar el panel. Desliza hacia abajo para reintentar.',
    );
  }
}
