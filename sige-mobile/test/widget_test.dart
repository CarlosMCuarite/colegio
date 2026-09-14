import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sige_flutter/shared/widgets/sige_button.dart';

void main() {
  testWidgets('SigeButton muestra su etiqueta y responde', (tester) async {
    var pressed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SigeButton(label: 'Ingresar', onPressed: () => pressed = true),
        ),
      ),
    );

    expect(find.text('Ingresar'), findsOneWidget);
    await tester.tap(find.text('Ingresar'));
    expect(pressed, isTrue);
  });
}
