import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';

class ManagementPage {
  const ManagementPage({
    required this.items,
    required this.total,
    this.meta = const {},
  });
  final List<Map<String, dynamic>> items;
  final int total;
  final Map<String, dynamic> meta;
}

class ManagementRepository {
  const ManagementRepository(this.client);
  final ApiClient client;

  Future<ManagementPage> list(String endpoint, {String query = ''}) async {
    try {
      final response = await client.dio.get<Map<String, dynamic>>(
        endpoint,
        queryParameters: {
          if (query.trim().isNotEmpty) 'q': query.trim(),
          'limit': endpoint == 'usuarios' || endpoint == 'auditoria/global'
              ? 300
              : 100,
        },
      );
      final body = response.data;
      final raw = body?['data'];
      final serverItems = raw is List
          ? raw.whereType<Map<String, dynamic>>().toList()
          : raw is Map<String, dynamic>
          ? [raw]
          : <Map<String, dynamic>>[];
      final normalizedQuery = query.trim().toLowerCase();
      final items = normalizedQuery.isEmpty
          ? serverItems
          : serverItems.where((item) {
              final searchable = item.values
                  .map((value) => value?.toString() ?? '')
                  .join(' ')
                  .toLowerCase();
              return searchable.contains(normalizedQuery);
            }).toList();
      final meta = body?['meta'];
      final total = meta is Map<String, dynamic> && meta['total'] is num
          ? (meta['total'] as num).toInt()
          : items.length;
      return ManagementPage(
        items: items,
        total: total,
        meta: meta is Map<String, dynamic> ? meta : const {},
      );
    } on DioException catch (error) {
      final body = error.response?.data;
      final message = body is Map<String, dynamic> && body['error'] is String
          ? body['error'] as String
          : 'No pudimos cargar esta información.';
      throw ManagementException(message);
    }
  }
}

class ManagementException implements Exception {
  const ManagementException(this.message);
  final String message;
}
