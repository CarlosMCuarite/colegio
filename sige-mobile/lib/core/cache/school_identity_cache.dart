import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

abstract final class SchoolIdentityCache {
  static const _key = 'sige_school_identity_v1';
  static Map<String, dynamic>? _value;

  static Map<String, dynamic>? get value => _value;

  static Future<void> bootstrap() async {
    final preferences = await SharedPreferences.getInstance();
    final stored = preferences.getString(_key);
    if (stored != null) {
      try {
        final decoded = jsonDecode(stored);
        if (decoded is Map<String, dynamic>) _value = decoded;
      } catch (_) {
        await preferences.remove(_key);
      }
    }
    try {
      final dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
          headers: const {'Accept': 'application/json'},
        ),
      );
      final response = await dio.get<Map<String, dynamic>>(
        'public/colegio/${AppConfig.schoolSlug}/check',
      );
      await update(_extract(response.data));
    } catch (_) {
      // La última identidad válida es la ruta offline intencional.
    }
  }

  static Future<Map<String, dynamic>?> refresh(Dio dio) async {
    try {
      final response = await dio.get<Map<String, dynamic>>(
        'public/colegio/${AppConfig.schoolSlug}/check',
      );
      final identity = _extract(response.data);
      await update(identity);
      return identity ?? _value;
    } catch (_) {
      return _value;
    }
  }

  static Future<void> update(Map<String, dynamic>? identity) async {
    if (identity == null || identity.isEmpty) return;
    _value = Map<String, dynamic>.from(identity);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_key, jsonEncode(_value));
  }

  static Map<String, dynamic>? _extract(Map<String, dynamic>? payload) {
    final data = payload?['data'];
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return null;
  }
}
