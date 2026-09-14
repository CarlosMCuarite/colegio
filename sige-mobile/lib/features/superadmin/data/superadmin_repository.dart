import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';

class SuperAdminRepository {
  const SuperAdminRepository(this.client);
  final ApiClient client;

  Future<Map<String, dynamic>> patch(
    String path, [
    Map<String, dynamic>? data,
  ]) async {
    final response = await client.dio.patch<Map<String, dynamic>>(
      path,
      data: data ?? const {},
    );
    return response.data ?? const {};
  }

  Future<Map<String, dynamic>> post(
    String path, [
    Map<String, dynamic>? data,
  ]) async {
    final response = await client.dio.post<Map<String, dynamic>>(
      path,
      data: data ?? const {},
    );
    return response.data ?? const {};
  }

  Future<Map<String, dynamic>> get(String path) async {
    final response = await client.dio.get<Map<String, dynamic>>(path);
    return response.data ?? const {};
  }

  Future<void> delete(String path) => client.dio.delete<void>(path);

  static String message(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map<String, dynamic> && data['error'] is String)
        return data['error'] as String;
    }
    return 'No se pudo completar la operación.';
  }
}
