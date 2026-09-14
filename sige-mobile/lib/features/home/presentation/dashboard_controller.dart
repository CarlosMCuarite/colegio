import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/user.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/dashboard_repository.dart';
import '../domain/dashboard_data.dart';

final dashboardProvider = FutureProvider.autoDispose
    .family<DashboardData, SigeUser>((ref, user) async {
      final client = await ref.watch(apiClientProvider.future);
      try {
        return await DashboardRepository(client).load(user);
      } on DioException catch (error) {
        throw DashboardException.fromDio(error);
      }
    });
