# Programa y fixture

Programa y Zona usan los mismos partidos. Abrir cualquiera de las vistas crea los partidos pendientes de la zona si aún no existen; después el director asigna las parejas a sus lugares. Programa muestra los nombres, resultados y referencias a los cruces anteriores del fixture. Las zonas de tres parejas tienen tres partidos y las de cuatro mantienen sus cuatro cruces.

La pestaña **Mapa** muestra las zonas y sus conexiones reales con cuartos, semifinales y final, agrupadas por categoría. Los colores identifican las sedes. Los filtros de categoría y sede se combinan; al elegir una sede se conservan los cruces que continúan desde sus zonas hasta la final. El zoom permite ampliar el cuadro y, en celular, se puede desplazar dentro del mapa.

La página pública **Torneos → Mapa** reutiliza `ProgramMap` en modo de consulta, con los mismos filtros, colores, parejas, horarios y resultados de eliminatorias. Consulta `GET /public/tournaments/current/map`, que lee el programa existente del torneo activo sin generar ni modificar partidos. La respuesta selecciona expresamente los campos públicos; no incluye DNI, contactos, comprobantes, notas internas ni asignaciones de personal. La vista se actualiza cada 30 segundos mientras está visible y al recuperar el foco. Las mejoras de presentación de `ProgramMap` se comparten con la app; las acciones de edición solo aparecen en Dirección. Este cambio no requiere una migración nueva.

Tocar una zona abre su nombre, sede, lugares para asignar o reemplazar parejas y partidos. Tocar un cruce permite editar cancha y horario, cargar el resultado si está listo o consultar el resultado si ya se jugó. Todas estas acciones usan los mismos registros y validaciones del fixture. El selector de torneo está junto al título; **Opciones** reúne la administración de canchas y el reparto automático.

Cada fila de `tournament_schedule_slots` se vincula mediante `matchId` único al partido de `tournament_matches`. La fila contiene la cancha, fecha y número general; el partido contiene participantes, fuentes y resultados. Todas las vistas leen la fecha y cancha de esa misma fila. La antigua columna de fecha del partido se conserva por compatibilidad de migración, pero no es la fuente utilizada por las vistas ni por las ediciones.

La migración `1789948800000-LinkProgramToMatches` vincula los partidos anteriores sin recrearlos. Si el fixture tenía un horario guardado, se conserva ese horario; en caso contrario se mantiene el de Programa. Se mantienen las canchas, los resultados y las parejas existentes. Las filas antiguas sobrantes de una zona de tres parejas quedan fuera de la vista, sin eliminar registros.

Con cuatro zonas, los cuartos usan 1.ª A–2.ª B, 1.ª B–2.ª A, 1.ª C–2.ª D y 1.ª D–2.ª C. La clasificación se completa cuando termina la zona, con los mismos criterios de la tabla pública: victorias, diferencia de puntos y puntos a favor. Las semifinales toman las ganadoras de cuartos 1–2 y 3–4; sus ganadoras pasan a la final. Los resultados se pueden cargar desde Programa sobre los mismos partidos.

Los programas existentes no se regeneran ni se renumeran al abrir la vista. Las nuevas zonas agregan partidos pendientes de programación. «Completar sin cambiar horarios» conserva los horarios y distribuye los partidos de zona según su sede configurada, incluso si antes tenían una cancha de otra sede. Las eliminatorias conservan su sede elegida.

En Programa, **Repartir entre canchas** abre el configurador de escenarios: día principal, día de finales, sede y cancha por zona y por cada cruce de cuartos, semifinales y final. La cancha puede ser específica o «Todas · repartir». La opción de intercalar alterna categorías dentro de cada sede y día, respetando los partidos previos. Los filtros del configurador solo limitan las filas visibles; la simulación siempre incluye todo el torneo.

Al abrir un escenario nuevo, todas las zonas y eliminatorias comienzan con **Todas · repartir**. Se toman las sedes y días del programa existente, pero las canchas anteriores no se convierten en restricciones. Para fijar una cancha hay que elegirla en el escenario. El reparto prioriza el turno más temprano; si varias canchas están disponibles a la misma hora, elige la que tiene menos partidos asignados ese día.

**Calcular vista previa** muestra cantidad de partidos, inicio y fin por día/sede y el detalle de canchas y horarios. Usa el horario de apertura y la duración de partido de cada sede. La cantidad de turnos diarios es una referencia: al superarla, continúa asignando horarios, incluso después de medianoche. Los partidos fuera de los turnos previstos aparecen en amarillo, se pueden filtrar y no impiden aplicar. El programa guardado también los marca al recargar. Las superposiciones, fechas de etapas incompatibles y horarios manuales anteriores a sus cruces previos siguen siendo errores que requieren corrección. La final espera a ambas semifinales, incluso en cuadros antiguos con referencias incompletas. **Aplicar escenario** actualiza las canchas y horarios de los partidos reales y las sedes configuradas en las zonas, manteniendo sus IDs, parejas y cruces. Los escenarios completos solo se aplican antes de cargar resultados.

Los endpoints `POST /tournaments/:id/program-scenario/preview` y `/apply` son exclusivos de Dirección. La vista previa revierte la transacción, incluso la generación de partidos faltantes. Aplicar exige la huella de esa vista previa: si cambiaron el escenario, los partidos o la configuración, hay que recalcular. Los horarios se guardan juntos en una transacción.

La vista previa muestra los partidos pendientes primero, con su sede/cancha prevista y la causa concreta (sin turno automático, superposición o cruces previos sin resolver). **Editar horario** permite fijar fecha, hora y cancha por partido y recalcular. Los horarios manuales se reservan antes del reparto automático; este debe dejar tiempo para los cruces previos y no ocupar esas reservas. Pueden extender los turnos automáticos de una sede, pero no superponerse ni anticiparse a un cruce previo. Se conservan durante las pruebas del escenario y se pueden quitar con **Volver a automático**. Los cambios solo se guardan con **Aplicar escenario**, cuando no quedan conflictos.

La acción alternativa **Completar sin cambiar horarios** genera partidos faltantes de categorías y zonas nuevas y asigna horarios vacíos aprovechando turnos disponibles, conservando los horarios existentes. Para cuatro zonas de tres parejas se generan 12 partidos de zona y 7 eliminatorias. Si faltan turnos, se indica cuántos partidos siguen sin horario.

Al guardar una zona con una sede seleccionada, sus partidos pendientes se distribuyen automáticamente en esa sede. Se conservan los IDs, horarios, parejas y resultados; los partidos ya jugados conservan su cancha anterior. Se tienen en cuenta los partidos que ya ocupan las canchas de destino. Si no existe una cancha activa libre en un horario, el cambio se rechaza completo y el formulario muestra el conflicto, sin dejar la zona y los partidos con asignaciones diferentes.

Desplegar backend y frontend. En producción, el inicio del backend aplica la migración cuando `DB_SYNCHRONIZE=false`. La reversión se bloquea si ya existen partidos de eliminatorias, para evitar perderlos.

Validación con PostgreSQL local, después de compilar el backend:

```powershell
node backend/scripts/verify-program-unification.cjs
```

La prueba crea y elimina una base temporal propia; verifica migración y reversión, conservación de horarios e IDs, consultas simultáneas, cambios desde ambas vistas, asignación de parejas y avance hasta la final.
