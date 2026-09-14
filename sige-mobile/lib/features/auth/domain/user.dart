class SchoolInfo {
  const SchoolInfo({
    required this.id,
    required this.name,
    this.logoUrl,
    this.primaryColor,
    this.secondaryColor,
    this.slug,
  });

  final String id;
  final String name;
  final String? logoUrl;
  final String? primaryColor;
  final String? secondaryColor;
  final String? slug;

  factory SchoolInfo.fromJson(Map<String, dynamic> json) => SchoolInfo(
    id: json['id']?.toString() ?? '',
    name: json['nombre']?.toString() ?? 'Mi colegio',
    logoUrl: json['logoUrl']?.toString(),
    primaryColor: json['colorPrimario']?.toString(),
    secondaryColor: json['colorSecundario']?.toString(),
    slug: json['slug']?.toString(),
  );
}

class SigeUser {
  const SigeUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.role,
    this.avatarUrl,
    this.school,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String role;
  final String? avatarUrl;
  final SchoolInfo? school;

  String get displayName => firstName.trim().isEmpty ? email : firstName.trim();
  bool get isSuperAdmin => role == 'SUPERADMIN';

  factory SigeUser.fromJson(Map<String, dynamic> json) {
    final schoolJson = json['colegio'];
    return SigeUser(
      id: json['id']?.toString() ?? '',
      firstName: json['nombres']?.toString() ?? '',
      lastName: json['apellidos']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['rol']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
      school: schoolJson is Map<String, dynamic>
          ? SchoolInfo.fromJson(schoolJson)
          : null,
    );
  }
}
