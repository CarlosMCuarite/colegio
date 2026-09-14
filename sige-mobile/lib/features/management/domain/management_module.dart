import 'package:flutter/material.dart';

class ManagementModule {
  const ManagementModule({
    required this.title,
    required this.endpoint,
    required this.icon,
    required this.color,
    required this.itemTitle,
    required this.itemSubtitle,
    this.searchable = true,
  });

  final String title;
  final String endpoint;
  final IconData icon;
  final Color color;
  final String Function(Map<String, dynamic>) itemTitle;
  final String Function(Map<String, dynamic>) itemSubtitle;
  final bool searchable;
}

String joinedName(Map<String, dynamic> item) =>
    '${item['nombres'] ?? ''} ${item['apellidos'] ?? ''}'.trim();

String nestedName(dynamic value, [String fallback = 'Sin asignar']) {
  if (value is Map<String, dynamic>) {
    return (value['nombre'] ?? value['name'] ?? fallback).toString();
  }
  return fallback;
}
