---
name: SIGE
description: Gestión escolar multirol, institucional, contemporánea y cercana.
colors:
  primary-blue: "#2563eb"
  primary-blue-hover: "#1d4ed8"
  institutional-navy: "#071a3d"
  blue-soft: "#e8f0ff"
  canvas: "#ffffff"
  surface-subtle: "#f5f8ff"
  ink: "#102044"
  ink-secondary: "#445472"
  ink-muted: "#6d7c99"
  border: "#dce5f4"
  danger: "#ef4444"
typography:
  display:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "clamp(3rem, 5.5vw, 5.75rem)"
    fontWeight: 650
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 3vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 650
    lineHeight: 1.4
rounded:
  control-sm: "8px"
  control: "12px"
  brand: "14px"
  overlay: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary-blue}"
    textColor: "#f5fffd"
    rounded: "{rounded.control}"
    padding: "0.8rem 1.1rem"
    height: "54px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-blue-hover}"
    textColor: "#f5fffd"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.8rem 3rem 0.8rem 2.9rem"
    height: "54px"
    typography: "{typography.body}"
---

# Design System: SIGE

## Provenance

Este contrato se creó mediante un flujo **code-first autorizado**, partiendo de la interfaz existente y del objetivo expresado para SIGE. No hubo roll visual ni una clave seed previa; la dirección persistida aquí y en `.impeccable/design.json` es la autoridad para las siguientes fases del rediseño.

## Overview

**Creative North Star: "El Centro de Control Escolar Vivo"**

SIGE se siente como una institución educativa contemporánea que ha convertido su complejidad en claridad: confiable, humana y activa. El azul profundo comunica estabilidad; el azul vivo orienta las acciones, mientras el búho institucional acompaña estados relevantes con gestos contenidos.

La jerarquía es directa, las superficies están contenidas y la densidad es cómoda para personas con distintos roles y niveles de experiencia digital. La composición favorece mensajes breves, controles previsibles y espacios suficientes para comprender el siguiente paso.

**Key Characteristics:**

- Institucional sin rigidez ni nostalgia académica.
- Azul marino como ancla y azul eléctrico como señal de interacción.
- El búho azul aparece como guía contextual, nunca como decoración repetitiva.
- Manrope como voz única, legible y contemporánea.
- Superficies contenidas, bordes suaves y profundidad ambiental discreta.
- Respuesta móvil deliberada, foco visible y movimiento no esencial reducible.

## Colors

La paleta combina una base neutra ligeramente verdosa con verdes fríos que transmiten calma, confianza y continuidad entre roles.

### Primary

- **Turquesa Institucional:** acción principal, foco, selección y enlaces interactivos; debe conservar su rareza para seguir orientando.
- **Petróleo de Comunidad:** fondos de marca, navegación estructural y grandes superficies institucionales con texto claro.

### Secondary

- **Menta de Apoyo:** fondos de hover suaves, iconografía auxiliar y señales no dominantes.

### Neutral

- **Lienzo Claro:** superficie principal y fondo de controles.
- **Niebla Verdosa:** agrupación secundaria y separación tonal sin añadir líneas innecesarias.
- **Tinta Profunda:** títulos y contenido que requiere máxima claridad.
- **Tinta Secundaria:** explicaciones, metadatos y texto de apoyo.
- **Tinta Atenuada:** placeholders, notas y contenido de menor prioridad.
- **Borde Sereno:** delimitación de campos, tarjetas y controles.

**The One Teal Voice Rule.** El turquesa principal señala acciones o estados activos; no debe competir consigo mismo en grandes áreas decorativas.

**The Semantic Color Rule.** Éxito, advertencia, peligro e información conservan sus roles funcionales y nunca se usan como decoración.

## Typography

**Display Font:** Manrope (con Segoe UI y sans-serif como respaldo)
**Body Font:** Manrope (con Segoe UI y sans-serif como respaldo)

**Character:** Una sola familia tipográfica crea continuidad entre administración, docentes, estudiantes y familias. Los pesos medios y fuertes dan autoridad; el espaciado ajustado en títulos aporta una voz contemporánea sin sacrificar legibilidad.

### Hierarchy

- **Display:** peso 650, escala fluida y línea compacta; reservado para mensajes institucionales de entrada y superficies de bienvenida.
- **Headline:** peso 700 y línea firme; títulos de página, formulario o módulo.
- **Title:** peso 600–700; encabezados de tarjetas y agrupaciones funcionales.
- **Body:** peso 400, línea holgada; instrucciones y contenido cotidiano, idealmente limitado a 48–72 caracteres por línea.
- **Label:** peso 650; nombres de campos, controles y estados donde la precisión es prioritaria.

**The One-Family Rule.** Toda la experiencia usa Manrope; la jerarquía se construye con tamaño, peso y espacio, no mezclando familias decorativas.

## Layout

El acceso usa una composición dividida: relato institucional flexible a la izquierda y formulario contenido a un máximo de 470px a la derecha. Por debajo de 920px el relato se retira y la marca acompaña al formulario; por debajo de 520px el contenido adopta márgenes de 24px y flujo vertical. Las áreas internas siguen un ritmo base de 8px, con 16–24px para grupos y 32–64px para separaciones estructurales.

En el producto autenticado, la navegación lateral mide 260px y la barra superior 60px; en pantallas de hasta 768px la navegación sale del lienzo y el contenido recupera todo el ancho. Las superficies de trabajo deben permanecer contenidas y evitar líneas de texto excesivamente largas.

**The Contained Task Rule.** Cada tarea principal ocupa una columna legible o una superficie claramente delimitada; no se estira un formulario solo para llenar el viewport.

## Elevation & Depth

SIGE combina capas tonales con sombras ambientales suaves. Los bordes establecen la estructura en reposo; las sombras indican elevación de tarjetas, botones, overlays o cambios de estado, nunca ornamentación pesada. El tema oscuro aumenta la opacidad de las sombras para preservar la separación entre superficies.

### Shadow Vocabulary

- **Reposo:** `0 1px 1px rgba(15,45,42,.04), 0 2px 4px rgba(15,45,42,.04)` para tarjetas y barras contenidas.
- **Interacción:** `0 1px 2px rgba(15,45,42,.05), 0 8px 24px rgba(15,45,42,.06)` para hover de superficies.
- **Overlay:** `0 2px 4px rgba(15,45,42,.06), 0 16px 48px rgba(15,45,42,.10)` para modales y ventanas flotantes.
- **Acción primaria:** una sombra teñida de turquesa refuerza el botón sin hacerlo brillante.

**The Border-Before-Shadow Rule.** La separación cotidiana nace del contraste tonal y el borde; la sombra se reserva para elevación real o respuesta interactiva.

## Shapes

Los controles combinan esquinas suaves de 8px o 12px; las marcas y overlays pueden llegar a 14–16px. Las cápsulas completas se reservan para estados y badges. Los círculos pertenecen a iconos flotantes o geometría ambiental, no a todos los controles.

**The Soft Precision Rule.** Las esquinas son amables pero contenidas: 12px es el radio habitual y 16px el máximo para superficies principales.

## Components

### Buttons

- **Shape:** bloque seguro y accesible, 54px de alto y radio de 12px en acciones principales.
- **Primary:** turquesa institucional con texto casi blanco, peso fuerte y contenido centrado.
- **Hover / Focus:** oscurece un paso, sube 1px y aumenta suavemente la sombra; el foco visible usa contorno de 2px con separación de 3px.
- **Icon Controls:** área táctil mínima de 44px, borde o fondo contextual y etiqueta accesible aunque el texto no sea visible.

### Chips

- **Style:** cápsula compacta con fondo semántico suave y texto de contraste alto.
- **State:** el color comunica estado real; una cápsula no se usa como adorno.

### Cards / Containers

- **Corner Style:** radio habitual de 12px y 16px solo para overlays o ventanas destacadas.
- **Background:** lienzo claro u oscuro según tema, separado del fondo secundario por tono y borde.
- **Shadow Strategy:** reposo mínimo; elevación ambiental únicamente al interactuar o superponerse.
- **Border:** línea de 1px con el borde sereno.
- **Internal Padding:** 20–24px para contenido estándar.

### Inputs / Fields

- **Style:** 54px de alto en autenticación, radio de 12px, fondo de superficie y borde de 1px; icono a la izquierda y acción secundaria a la derecha cuando corresponda.
- **Focus:** borde turquesa y halo de 3px mezclado al 16%; nunca se elimina el indicador sin reemplazo visible.
- **Error / Disabled:** el peligro reemplaza borde y halo; el mensaje específico aparece junto al campo y el mensaje general en una región anunciable.

### Navigation

La navegación estructural usa fondo petróleo, etiquetas compactas y estados activos con turquesa. Hover y activo cambian color y superficie sin alterar el tamaño. En móvil, la navegación lateral se convierte en panel fuera del lienzo.

## Do's and Don'ts

### Do:

- **Do** usar Manrope y una jerarquía de peso clara para que todos los roles reconozcan el mismo producto.
- **Do** mantener objetivos táctiles de al menos 44px y focos visibles en toda acción.
- **Do** usar transiciones discretas de 200–320ms con easing desacelerado y respetar `prefers-reduced-motion`.
- **Do** validar las composiciones a 375px, 768px, 1024px y 1440px.
- **Do** usar iconos SVG de una familia coherente y acompañarlos con etiquetas accesibles cuando su significado no sea obvio.

### Don't:

- **Don't** introducir serif académicas, ámbar promocional o nostalgia visual: contradicen la implementación institucional contemporánea.
- **Don't** usar sombras densas, gradientes vistosos o decoración que compita con las tareas escolares.
- **Don't** ocultar foco, error o estado solo mediante un cambio de color sutil.
- **Don't** comprimir el diseño de escritorio en móvil ni permitir desplazamiento horizontal accidental.
- **Don't** animar contenido esencial ni usar desplazamientos mayores de 16px para entradas de interfaz.
