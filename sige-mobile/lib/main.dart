import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/cache/school_identity_cache.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SchoolIdentityCache.bootstrap();
  runApp(const ProviderScope(child: SigeApp()));
}
