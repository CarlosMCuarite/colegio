class DashboardData {
  const DashboardData({required this.kind, required this.data});

  final DashboardKind kind;
  final Map<String, dynamic> data;

  Map<String, dynamic> get kpis => _map(data['kpis']);
  Map<String, dynamic> get alerts => _map(data['alertas']);
  Map<String, dynamic> get charts => _map(data['graficos']);
  List<dynamic> get schoolsByStatus => _list(data['colegiosPorEstado']);
  List<dynamic> get usersByRole => _list(charts['usuariosPorRol']);
  List<dynamic> get enrollmentsByMonth => _list(charts['matriculasPorMes']);
  List<dynamic> get revenueByMonth => _list(charts['ingresosPorMes']);
  List<dynamic> get globalAttendance => _list(charts['asistenciaGlobal']);
  List<dynamic> get students => _list(data['estudiantes']);
  List<dynamic> get announcements => _list(data['comunicados']);
  List<dynamic> get events => _list(data['eventos'] ?? data['eventosProximos']);
  int get unreadNotifications => _integer(data['totalNotifNoLeidas']);
  double get totalDebt => _number(data['totalDeuda']);

  static Map<String, dynamic> _map(dynamic value) =>
      value is Map<String, dynamic> ? value : const {};
  static List<dynamic> _list(dynamic value) => value is List ? value : const [];
  static int _integer(dynamic value) => value is num ? value.toInt() : 0;
  static double _number(dynamic value) => value is num ? value.toDouble() : 0;
}

enum DashboardKind { superAdmin, executive, family, staff }
