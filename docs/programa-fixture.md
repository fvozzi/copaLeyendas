# Programa y fixture

Programa y Zona usan los mismos partidos. Abrir cualquiera de las vistas crea los partidos pendientes de la zona si aún no existen; después el director asigna las parejas a sus lugares. Programa muestra los nombres, resultados y referencias a los cruces anteriores del fixture. Las zonas de tres parejas tienen tres partidos y las de cuatro mantienen sus cuatro cruces.

Cada fila de `tournament_schedule_slots` se vincula mediante `matchId` único al partido de `tournament_matches`. La fila contiene la cancha, fecha y número general; el partido contiene participantes, fuentes y resultados. Todas las vistas leen la fecha y cancha de esa misma fila. La antigua columna de fecha del partido se conserva por compatibilidad de migración, pero no es la fuente utilizada por las vistas ni por las ediciones.

La migración `1789948800000-LinkProgramToMatches` vincula los partidos anteriores sin recrearlos. Si el fixture tenía un horario guardado, se conserva ese horario; en caso contrario se mantiene el de Programa. Se mantienen las canchas, los resultados y las parejas existentes. Las filas antiguas sobrantes de una zona de tres parejas quedan fuera de la vista, sin eliminar registros.

Con cuatro zonas, los cuartos usan 1.ª A–2.ª B, 1.ª B–2.ª A, 1.ª C–2.ª D y 1.ª D–2.ª C. La clasificación se completa cuando termina la zona, con los mismos criterios de la tabla pública: victorias, diferencia de puntos y puntos a favor. Las semifinales toman las ganadoras de cuartos 1–2 y 3–4; sus ganadoras pasan a la final. Los resultados se pueden cargar desde Programa sobre los mismos partidos.

Los programas existentes no se regeneran ni se renumeran al abrir la vista. Las nuevas zonas agregan partidos pendientes de programación. «Repartir entre canchas» conserva los horarios y solo cambia la cancha de los partidos vinculados.

Desplegar backend y frontend. En producción, el inicio del backend aplica la migración cuando `DB_SYNCHRONIZE=false`. La reversión se bloquea si ya existen partidos de eliminatorias, para evitar perderlos.

Validación con PostgreSQL local, después de compilar el backend:

```powershell
node backend/scripts/verify-program-unification.cjs
```

La prueba crea y elimina una base temporal propia; verifica migración y reversión, conservación de horarios e IDs, consultas simultáneas, cambios desde ambas vistas, asignación de parejas y avance hasta la final.
