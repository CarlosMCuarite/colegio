import 'dart:convert';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

class ApiClient {
  ApiClient._(this.dio, this.cookieJar);

  final Dio dio;
  final PersistCookieJar cookieJar;

  static Future<ApiClient> create() async {
    final directory = await getApplicationSupportDirectory();
    final jar = PersistCookieJar(
      storage: FileStorage('${directory.path}/.sige_session/'),
      ignoreExpires: false,
    );
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Colegio-Id': AppConfig.schoolId,
        },
      ),
    );
    dio.interceptors.add(CookieManager(jar));
    dio.interceptors.add(
      _ResponseCacheInterceptor(await SharedPreferences.getInstance()),
    );
    return ApiClient._(dio, jar);
  }

  Future<void> clearSession() => cookieJar.deleteAll();

  void useSchoolContext(String schoolId) {
    dio.options.headers['X-Colegio-Id'] = schoolId;
  }

  void restoreDefaultSchoolContext() {
    dio.options.headers['X-Colegio-Id'] = AppConfig.schoolId;
  }
}

class _ResponseCacheInterceptor extends Interceptor {
  _ResponseCacheInterceptor(this.preferences);

  final SharedPreferences preferences;
  static const _prefix = 'sige_http_cache_v1_';
  static const _freshFor = Duration(seconds: 45);

  bool _cacheable(RequestOptions options) =>
      options.method == 'GET' &&
      !options.path.contains('/auth/') &&
      !options.path.startsWith('auth/') &&
      !options.path.contains('download');

  String _key(RequestOptions options) {
    final school = options.headers['X-Colegio-Id']?.toString() ?? '';
    return '$_prefix${base64Url.encode(utf8.encode('$school|${options.uri}'))}';
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!_cacheable(options)) return handler.next(options);
    final raw = preferences.getString(_key(options));
    if (raw != null) {
      try {
        final entry = jsonDecode(raw) as Map<String, dynamic>;
        final savedAt = DateTime.parse(entry['savedAt'] as String);
        if (DateTime.now().difference(savedAt) <= _freshFor) {
          return handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: entry['data'],
              headers: Headers.fromMap(const {
                'x-sige-cache': ['fresh'],
              }),
            ),
          );
        }
      } catch (_) {
        preferences.remove(_key(options));
      }
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final options = response.requestOptions;
    if (_cacheable(options) && response.data != null) {
      try {
        final encoded = jsonEncode({
          'savedAt': DateTime.now().toIso8601String(),
          'data': response.data,
        });
        if (encoded.length < 750000) {
          preferences.setString(_key(options), encoded);
        }
      } catch (_) {
        // Algunos binarios o streams no son serializables y no se cachean.
      }
    } else if (options.method != 'GET') {
      _clear();
    }
    handler.next(response);
  }

  @override
  void onError(DioException error, ErrorInterceptorHandler handler) {
    final options = error.requestOptions;
    if (_cacheable(options) &&
        error.response == null &&
        error.type != DioExceptionType.cancel) {
      final raw = preferences.getString(_key(options));
      if (raw != null) {
        try {
          final entry = jsonDecode(raw) as Map<String, dynamic>;
          return handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: entry['data'],
              headers: Headers.fromMap(const {
                'x-sige-cache': ['offline'],
              }),
            ),
          );
        } catch (_) {}
      }
    }
    handler.next(error);
  }

  Future<void> _clear() async {
    for (final key in preferences.getKeys().where(
      (key) => key.startsWith(_prefix),
    )) {
      await preferences.remove(key);
    }
  }
}
