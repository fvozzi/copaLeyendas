# Casos de uso

## Caso de uso 1. Habilitacion por token y registro de jugadoras

- Objetivo: recibir y administrar inscripciones de localidades habilitadas previamente por Direccion del Torneo.
- Actores:
  - Directora o director del torneo que habilita la localidad.
  - Delegada o responsable local que recibe el token.
  - Administracion del torneo que valida, confirma o rechaza la inscripcion.
- Disparador: una localidad es habilitada para inscribirse en la edicion del 21 y 22 de noviembre de 2026.
- Categorias iniciales:
  - `Damas A`
  - `Damas B`
  - `Damas Nucleo A`
  - `Damas Nucleo B`

### Flujo principal

1. Direccion del Torneo crea una habilitacion desde el backoffice.
2. Informa categoria, localidad, provincia y club.
3. Opcionalmente marca que esa inscripcion queda bonificada.
4. El sistema genera un token unico.
5. La organizacion comparte ese token con la delegada habilitada.
6. La delegada entra a la pantalla publica de inscripcion.
7. Ingresa el token.
8. El sistema valida que el token exista, este activo y no haya sido usado.
9. Recien entonces se muestra el formulario completo.
10. La delegada confirma disponibilidad para jugar los dias 21 y 22 de noviembre de 2026.
11. Informa como conocio el evento.
12. Carga las jugadoras titulares y, si corresponde, jugadora 3.
13. Informa talles de camiseta.
14. Si la inscripcion no fue bonificada, adjunta comprobante de pago.
15. Envia la inscripcion.
16. El sistema registra la solicitud con estado `RECEIVED` y marca el token como `USED`.
17. La administracion revisa la solicitud desde el backoffice.
18. La administracion actualiza el estado a `UNDER_REVIEW`, `CONFIRMED`, `WAITLIST` o `REJECTED`.

### Reglas

- Nadie puede inscribirse sin un token valido.
- Cada token habilita una sola inscripcion.
- La localidad, provincia, club y categoria provienen de la habilitacion emitida por Direccion del Torneo.
- La habilitacion puede marcar la inscripcion como bonificada.
- Deben existir dos jugadoras titulares obligatorias.
- La tercera jugadora es opcional, pero si se informa debe quedar completa.
- La confirmacion de disponibilidad para los dias 21 y 22 de noviembre de 2026 es obligatoria.
- El comprobante de pago es obligatorio salvo que la habilitacion este bonificada.
- La administracion puede agregar notas internas sin exponerlas en el sitio publico.

### Datos minimos modelados

- Habilitacion:
  - Token
  - Categoria
  - Localidad
  - Provincia
  - Club
  - Contacto opcional
  - Bonificacion de inscripcion
  - Estado del token
- Registro:
  - Medio por el que conocio el evento
  - Confirmacion de disponibilidad
  - Ciudad/provincia representada
  - Email de contacto opcional
  - Marca de inscripcion bonificada
  - Delantera: nombre, DNI, fecha de nacimiento, celular, Instagram, talle
  - Zaguera: nombre, DNI, fecha de nacimiento, celular, Instagram, talle
  - Jugadora 3 opcional: mismos datos
  - Comprobante de pago cuando corresponda
- Estado de revision
- Nota interna de administracion

## Caso de uso 2. Publicacion de contenidos por seccion

- Objetivo: mantener viva la web con notas cargadas desde la app.
- Actores:
  - Administracion o editora.
  - Visitante publico del sitio.
- Secciones:
  - `Leyendas`
  - `Canchas`
  - `Torneos`
  - `Historias`

### Flujo principal

1. La editora inicia sesion en el backoffice.
2. Crea una publicacion, asigna seccion, copete y cuerpo.
3. Decide si queda como borrador, publicada o destacada.
4. El sitio publico muestra la nota en home, en la seccion correspondiente y en su detalle.

## Caso de uso 3. Seguimiento operativo del torneo

- Objetivo: ver rapidamente el estado general del contenido y de la convocatoria.
- Actor: administracion del torneo.

### Flujo principal

1. La administracion entra al dashboard.
2. Consulta cantidad total de publicaciones, publicadas y destacadas.
3. Consulta volumen de tokens emitidos por categoria y por estado.
4. Consulta volumen de inscripciones por categoria y por estado.
5. Usa esa lectura para priorizar validaciones y comunicacion.
