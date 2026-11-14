# Plan de pruebas · Carga de resultados Damas B

Objetivo: validar de punta a punta, en el entorno local, el trabajo simultáneo de dos responsables de cancha en dos sedes, desde el inicio con foto hasta la publicación del resultado y la placa final.

## Preparación

- [ ] Restaurar el backup local y ejecutar las migraciones pendientes.
- [ ] Confirmar que Damas B tiene zonas, fixture y partidos programados en dos sedes.
- [ ] Confirmar que cada partido tiene cancha, horario, pareja local y pareja visitante.
- [ ] Crear o elegir dos usuarios responsables de cancha.
- [ ] Asignar al Responsable A solamente a la Sede A y al Responsable B solamente a la Sede B.
- [ ] Abrir tres sesiones separadas: perfil de navegador A, perfil de navegador B y una ventana pública sin iniciar sesión.
- [ ] Preparar al menos cuatro fotos de prueba horizontales. En cada una, ubicar la pareja local a la izquierda y la visitante a la derecha.

Registrar antes de empezar:

| Dato | Responsable A | Responsable B |
|---|---|---|
| Usuario |  |  |
| Sede |  |  |
| Cancha |  |  |
| Primer partido | P | P |

## Recorrido principal

### 1. Verificar permisos

- [ ] Ingresar con ambos responsables a `/app/resultados`.
- [ ] Cada responsable ve únicamente los partidos de las canchas o sedes que tiene asignadas.
- [ ] Ninguno puede iniciar ni cargar resultados de la otra sede.
- [ ] Los partidos todavía no iniciados muestran `Listo para jugar`.

### 2. Iniciar un partido en la Sede A

- [ ] Responsable A elige `Iniciar partido`.
- [ ] El cuadro muestra claramente `Izquierda · Local` y `Derecha · Visitante` con las parejas correctas.
- [ ] Intentar continuar sin foto: el sistema no debe permitirlo.
- [ ] Seleccionar la foto y pulsar `Publicar e iniciar partido`.
- [ ] El partido cambia a `En juego` y queda disponible la acción `Cargar resultado`.
- [ ] `Ver foto` abre la imagen inicial correctamente orientada y visible desde navegador.

### 3. Verificar la publicación pública

- [ ] Abrir la página pública del torneo sin iniciar sesión.
- [ ] En un máximo de 15 segundos aparece la sección `Partidos en juego`.
- [ ] Se ve la foto, categoría Damas B, zona o etapa, sede, ambas parejas y hora de inicio.
- [ ] El mismo partido figura como `En juego` dentro de su zona.
- [ ] Actualizar la página: el estado y la foto se conservan.

### 4. Probar simultaneidad en la Sede B

- [ ] Mientras el partido A sigue en juego, Responsable B inicia un partido de su sede.
- [ ] La página pública muestra los dos partidos sin reemplazar ni mezclar fotos o parejas.
- [ ] Responsable A sigue sin poder operar el partido B y viceversa.

### 5. Validar controles del resultado

Usar primero el partido de la Sede A.

- [ ] Pulsar `Cargar resultado`.
- [ ] Probar empate: debe rechazarse.
- [ ] Probar un resultado sin que ninguna pareja llegue al puntaje objetivo: debe rechazarse.
- [ ] Probar que ambas parejas lleguen al puntaje objetivo: debe rechazarse.
- [ ] Cargar un resultado válido: una pareja llega al puntaje objetivo y la otra queda por debajo.

### 6. Verificar cierre y placa final

- [ ] El partido cambia de `En juego` a resultado final.
- [ ] La página pública deja de mostrarlo en `Partidos en juego`.
- [ ] `Ver foto final` abre una imagen JPG generada por el sistema.
- [ ] La pareja local aparece identificada a la izquierda con equipo y tantos.
- [ ] La pareja visitante aparece identificada a la derecha con equipo y tantos.
- [ ] El logo de Copa Leyendas aparece centrado y legible.
- [ ] Los nombres largos no se superponen ni salen de la imagen.
- [ ] La foto original conserva una calidad razonable y su orientación correcta.
- [ ] La tabla de posiciones actualiza PJ, PG, diferencia y tantos a favor.

### 7. Verificar continuidad deportiva

- [ ] Finalizar el partido de la Sede B y comprobar los mismos puntos anteriores.
- [ ] Completar todos los partidos de una zona según la metodología configurada para Damas B.
- [ ] Si hay cruces dependientes, los ganadores, perdedores o clasificados se ubican en el partido correcto.
- [ ] El siguiente partido pasa a `Listo para jugar` solamente cuando tiene las dos parejas definidas.
- [ ] Iniciar y finalizar al menos un partido de la segunda etapa.
- [ ] Confirmar que el mapa, la programación y la vista por categoría muestran el mismo estado y resultado.

## Casos de recuperación

- [ ] Subir un archivo que no sea una imagen: el inicio debe rechazarse sin dejar el partido `En juego`.
- [ ] Cortar la conexión antes de confirmar el inicio: al reintentar no debe haber una foto o estado parcial.
- [ ] Hacer doble clic al iniciar: debe existir un solo inicio y una sola foto.
- [ ] Intentar cargar dos veces el resultado: el segundo intento no debe modificar el primero.
- [ ] Recargar el navegador durante un partido: debe recuperarse el estado `En juego`.
- [ ] Probar desde un teléfono real o con vista móvil: cámara, selector de archivo, diálogo y botones deben ser utilizables.

## Cierre de la prueba

Por cada incidencia anotar partido, usuario, sede, hora, acción, mensaje mostrado y captura. Al terminar, comparar:

- [ ] Resultados de la pantalla operativa.
- [ ] Vista pública.
- [ ] Posiciones de Damas B.
- [ ] Clasificados y cruces siguientes.
- [ ] Historial de actividad y códigos de error, si los hubo.

No reutilizar esta base como dato definitivo del torneo: al concluir, restaurar nuevamente el backup de prueba o documentar todos los resultados ficticios cargados.
