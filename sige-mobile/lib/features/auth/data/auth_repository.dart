import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/user.dart';

class AuthException implements Exception {
  const AuthException(this.message);
  final String message;
}

class AuthRepository {
  AuthRepository(this.client);
  final ApiClient client;

  Future<SigeUser> login(String email, String password) async {
    try {
      final response = await client.dio.post<Map<String, dynamic>>(
        'auth/login',
        data: {'email': email, 'password': password},
      );
      final user = _readUser(response.data);
      _configureTenant(user);
      return user;
    } on DioException catch (error) {
      throw AuthException(_messageFor(error));
    }
  }

  Future<SigeUser?> restoreSession() async {
    try {
      final response = await client.dio.get<Map<String, dynamic>>('auth/me');
      final user = _readUser(response.data);
      _configureTenant(user);
      return user;
    } on DioException {
      return null;
    }
  }

  Future<void> logout() async {
    try {
      await client.dio.post<void>('auth/logout');
    } finally {
      await client.clearSession();
    }
  }

  SigeUser _readUser(Map<String, dynamic>? body) {
    final user = body?['usuario'] ?? body?['data'];
    if (user is Map<String, dynamic>) return SigeUser.fromJson(user);
    throw const AuthException('El servidor no devolvió un perfil válido.');
  }

  void _configureTenant(SigeUser user) {
    // El aplicativo está personalizado para un colegio, pero el SUPERADMIN
    // debe consultar la plataforma completa. Enviar X-Colegio-Id en ese rol
    // limitaría silenciosamente colegios, usuarios, auditoría y dashboard.
    if (user.isSuperAdmin) {
      client.dio.options.headers.remove('X-Colegio-Id');
    }
  }

  String _messageFor(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic> && data['error'] is String) {
      return data['error'] as String;
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return 'El servidor está tardando. Inténtalo nuevamente en un momento.';
    }
    if (error.response?.statusCode == 401) {
      return 'El correo o la contraseña no coinciden.';
    }
    return 'No pudimos conectar con SIGE. Revisa tu internet e inténtalo otra vez.';
  }
}
