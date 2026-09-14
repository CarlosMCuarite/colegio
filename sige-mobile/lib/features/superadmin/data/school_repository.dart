import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';

class SchoolRepository {
  const SchoolRepository(this.client);
  final ApiClient client;

  Future<Map<String, dynamic>> detail(String id) async {
    final response = await client.dio.get<Map<String, dynamic>>('colegios/$id');
    return _data(response.data);
  }

  Future<Map<String, dynamic>> update(
    String id,
    Map<String, dynamic> values,
  ) async {
    final response = await client.dio.patch<Map<String, dynamic>>(
      'colegios/$id',
      data: values,
    );
    return _data(response.data);
  }

  Future<void> setStatus(String id, String status) async {
    await client.dio.patch<void>(
      'colegios/$id/estado',
      data: {'estado': status},
    );
  }

  Future<Map<String, dynamic>> supportAccess(String id) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      'colegios/$id/soporte-acceso',
    );
    return _data(response.data);
  }

  Future<List<Map<String, dynamic>>> plans() async {
    final response = await client.dio.get<Map<String, dynamic>>(
      'membresias/planes',
    );
    final raw = response.data?['data'];
    return raw is List ? raw.whereType<Map<String, dynamic>>().toList() : [];
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> values) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      'colegios',
      data: values,
    );
    return response.data ?? const {};
  }

  Map<String, dynamic> _data(Map<String, dynamic>? body) {
    final value = body?['data'];
    if (value is Map<String, dynamic>) return value;
    throw const SchoolException('El servidor no devolvió datos válidos.');
  }

  static String errorMessage(Object error) {
    if (error is DioException) {
      final body = error.response?.data;
      if (body is Map<String, dynamic> && body['error'] is String) {
        return body['error'] as String;
      }
    }
    return 'No se pudo completar la operación.';
  }
}

class SchoolException implements Exception {
  const SchoolException(this.message);
  final String message;
}
