import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
import '../domain/user.dart';

class AuthState {
  const AuthState({
    this.user,
    this.isBootstrapping = false,
    this.isSubmitting = false,
    this.error,
  });

  final SigeUser? user;
  final bool isBootstrapping;
  final bool isSubmitting;
  final String? error;

  AuthState copyWith({
    SigeUser? user,
    bool clearUser = false,
    bool? isBootstrapping,
    bool? isSubmitting,
    String? error,
    bool clearError = false,
  }) => AuthState(
    user: clearUser ? null : user ?? this.user,
    isBootstrapping: isBootstrapping ?? this.isBootstrapping,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    error: clearError ? null : error ?? this.error,
  );
}

final apiClientProvider = FutureProvider<ApiClient>(
  (ref) => ApiClient.create(),
);

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) {
    final controller = AuthController(ref);
    controller.bootstrap();
    return controller;
  },
);

class AuthController extends StateNotifier<AuthState> {
  AuthController(this.ref) : super(const AuthState(isBootstrapping: true));
  final Ref ref;

  Future<AuthRepository> get _repository async =>
      AuthRepository(await ref.read(apiClientProvider.future));

  Future<void> bootstrap() async {
    final user = await (await _repository).restoreSession();
    if (mounted) state = AuthState(user: user);
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final user = await (await _repository).login(email, password);
      if (mounted) state = AuthState(user: user);
    } on AuthException catch (error) {
      if (mounted) {
        state = state.copyWith(isSubmitting: false, error: error.message);
      }
    }
  }

  Future<void> logout() async {
    await (await _repository).logout();
    if (mounted) state = const AuthState();
  }

  void clearError() => state = state.copyWith(clearError: true);
}
