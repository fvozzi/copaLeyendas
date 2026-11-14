# Prueba de concurrencia para el día del torneo

El objetivo inicial es demostrar que el sistema sostiene **30 usuarios virtuales**, no solamente 30 visitas totales. Cada usuario mantiene actividad durante la prueba y al final se ejecutan ráfagas de 30 solicitudes verdaderamente simultáneas.

La prueba del servidor es estrictamente pública: solo usa `GET`, no inicia sesión, no inicia partidos, no carga resultados y no modifica equipos, zonas ni inscripciones. Las consultas sí crean filas en **Actividad**, porque ese es el comportamiento real de la aplicación y forma parte de la carga que debe soportar PostgreSQL.

## Qué simula

1. Subida gradual hasta 30 usuarios para evitar confundir el arranque con la carga sostenida.
2. Apertura inicial del torneo, mapa y contenidos.
3. Consulta periódica de partidos y posiciones cada 3 segundos. La web real actualiza cada 15 segundos, por lo que esta frecuencia aplica un margen de presión de aproximadamente 5×.
4. Descarga de las fotografías de los partidos que estén `En juego`, si las hay.
5. Tres ráfagas finales de 30 solicitudes simultáneas.

No prueba la subida de fotografías ni la escritura de 30 resultados simultáneos. Esas acciones corresponden a una segunda prueba funcional controlada con partidos ficticios.

## Prueba local básica

Levantar el backend con la base restaurada:

```powershell
npm run dev:backend
```

En otra terminal:

```powershell
npm run test:load
```

Valores predeterminados:

- API: se detecta automáticamente usando `PORT` de `backend/.env` (en ausencia del archivo usa `http://localhost:3000/api`).
- 30 usuarios virtuales.
- 10 segundos de subida gradual.
- 60 segundos de carga sostenida.
- Tres ráfagas de 30 solicitudes simultáneas.
- Máximo 1% de errores, p95 de 1 segundo y p99 de 2 segundos.

Para incluir también la entrega del frontend, levantarlo y agregar su URL:

```powershell
npm run dev:frontend
npm run test:load -- --site-url http://localhost:5174
```

## Ensayo recomendado

Ejecutar tres escalones sobre el mismo backup y comparar resultados:

```powershell
npm run test:load -- --users 10 --duration 60 --output tmp/load-10.json
npm run test:load -- --users 20 --duration 60 --output tmp/load-20.json
npm run test:load -- --users 30 --duration 120 --output tmp/load-30.json
```

Si 30 aprueba con comodidad, realizar una última prueba de margen con 50 usuarios:

```powershell
npm run test:load -- --users 50 --duration 120 --output tmp/load-50.json
```

Durante la ejecución conviene observar en el servidor:

- CPU y memoria del proceso backend.
- CPU, conexiones y consultas de PostgreSQL.
- espacio en disco y crecimiento de `activity_logs`.
- errores o reinicios del servicio.

## Probar producción

Solo hacerlo en un horario acordado y con autorización. El script rechaza destinos remotos salvo confirmación explícita:

```powershell
npm run test:load -- `
  --api-url https://copaleyendas.com.ar/api `
  --site-url https://copaleyendas.com.ar `
  --users 30 `
  --duration 120 `
  --allow-remote `
  --output tmp/load-produccion-30.json
```

Comenzar siempre con 5 o 10 usuarios antes de ejecutar 30 sobre producción.

## Prueba local de siete resultados simultáneos

Esta segunda prueba es deliberadamente destructiva y **solo admite localhost**. Selecciona siete partidos completos en estado `READY` de Damas B y ejecuta dos ráfagas:

1. Sube la foto e inicia los siete partidos simultáneamente.
2. Carga los siete resultados simultáneamente, incluyendo la generación de las placas finales.
3. Vuelve a consultar la operación y verifica que todos hayan quedado `PLAYED`.

Restaurar primero el backup de pruebas, levantar el backend y definir un usuario director local:

```powershell
npm run db:restore:local
npm run dev:backend
```

En otra terminal:

```powershell
$env:LOAD_TEST_EMAIL="director-local@ejemplo.com"
$env:LOAD_TEST_PASSWORD="CLAVE_LOCAL"
npm run test:load:results -- `
  --category "Damas B" `
  --count 7 `
  --confirm-local-writes `
  --output tmp/resultados-concurrentes-7.json
Remove-Item Env:LOAD_TEST_EMAIL
Remove-Item Env:LOAD_TEST_PASSWORD
```

Por defecto utiliza `frontend/public/LogoFemme.png` como imagen válida de prueba. Para simular mejor el peso de una fotografía real:

```powershell
npm run test:load:results -- `
  --category "Damas B" `
  --count 7 `
  --photo C:\temp\foto-partido.jpg `
  --confirm-local-writes
```

También se pueden elegir partidos determinados:

```powershell
npm run test:load:results -- --match-ids 101,102,103,104,105,106,107 --confirm-local-writes
```

Si algún inicio falla, el script no envía la segunda ráfaga de resultados, pero los partidos que sí comenzaron pueden quedar `En juego`. Al finalizar, restaurar nuevamente el backup para descartar todos los resultados y archivos ficticios.

## Cómo leer el resultado

La salida muestra por operación:

- cantidad de solicitudes y errores;
- latencias p50, p95 y p99;
- códigos HTTP recibidos;
- solicitudes promedio por segundo.

La ejecución termina con código `0` y `RESULTADO: APROBADO` cuando:

- los errores son como máximo 1%;
- el 95% de las respuestas tarda como máximo 1 segundo;
- el 99% tarda como máximo 2 segundos.

Un promedio bajo no alcanza si p95 o p99 son altos: esos percentiles representan las demoras que sufrirán las personas cuando varias consultas coincidan.
