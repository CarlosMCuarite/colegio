abstract final class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://sige-backend-wzmn.onrender.com/api/v1/',
  );
  static const schoolId = String.fromEnvironment(
    'SCHOOL_ID',
    defaultValue: 'cmr2nglct00043unmt7ln18df',
  );
  static const schoolName = String.fromEnvironment(
    'SCHOOL_NAME',
    defaultValue: 'I.E.P. Encinas',
  );
  static const schoolSlug = String.fromEnvironment(
    'SCHOOL_SLUG',
    defaultValue: 'encinas',
  );
}
