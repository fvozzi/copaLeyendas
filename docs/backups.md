# Backups de Copa Leyendas

Dirección administra las copias desde **Backups** (`/app/backups`). Incluye creación manual en segundo plano, historial de estado, fecha, origen, tamaño y descarga autenticada. Solo una copia puede ejecutarse a la vez, incluso si hay varios procesos del backend.

Por defecto se realiza un backup diario a las **03:00 de Argentina** y se conservan las **30 copias completadas más recientes**, incluyendo las manuales. Se puede cambiar el horario, pausar el automático y ajustar la retención de 1 a 365 desde el panel. La retención se aplica después de completar un backup nuevo; una ejecución fallida no elimina las copias anteriores.

El backend revisa el horario al arrancar y cada minuto. Si arranca después del horario previsto, ejecuta la copia de ese día si todavía no hubo un intento automático. No recrea copias de los días en que estuvo apagado. Un fallo queda registrado y puede reintentarse manualmente; el próximo automático será al día siguiente. Si se interrumpe el proceso, el registro queda marcado como fallido en la siguiente comprobación.

## Alcance

Se usa `pg_dump --format=custom --no-owner --no-privileges`, igual que en Propia. Contiene el esquema y los datos de PostgreSQL (inscripciones, jugadoras, torneos, partidos, usuarios, caja, etc.). **No incluye fotos, comprobantes u otros archivos locales, archivos de Drive, variables de entorno ni roles globales de PostgreSQL.** Los respaldos del almacenamiento de archivos deben mantenerse por separado.

Las copias locales sobreviven a los deploys habituales, pero no a la pérdida del servidor/disco. Descargar una copia permite conservarla fuera del servidor.

## Despliegue

1. Desplegar frontend y backend y ejecutar las migraciones. `1789862400000-AddDatabaseBackups` crea la configuración y el historial. El script habitual de deploy ya ejecuta las migraciones.
2. El servidor necesita `pg_dump`, provisto por el cliente PostgreSQL. Usar la misma versión principal que la base o una compatible más reciente. El bootstrap instala `postgresql-client`.
3. Los scripts de bootstrap/deploy crean `shared/backups` con permisos `0700` para el usuario de la aplicación. Los archivos se generan con permisos `0600` y no se publican por nginx.
4. Entrar a **Backups → Crear backup ahora**, esperar **Completado** y descargar para verificar la instalación.

Configuración opcional en el `.env` del backend:

```dotenv
BACKUP_STORAGE_DIR=/var/www/copa-leyendas/shared/backups
PG_DUMP_BINARY=pg_dump
```

Sin variables nuevas, el backend usa `../../shared/backups` si existe el directorio `shared` del despliegue; en desarrollo usa `storage/backups` relativo al directorio de trabajo del backend. No configurar este directorio dentro del sitio público. En Windows se puede indicar `PG_DUMP_BINARY=C:/Program Files/PostgreSQL/18/bin/pg_dump.exe`.

Las credenciales provienen de las mismas variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` de la aplicación. La contraseña no se pasa en argumentos ni se devuelve al panel. El proceso tiene un límite de 30 minutos y se cancela al detener el backend.

## Verificación y restauración

Usar una base **nueva y vacía** para verificar una copia, sin apuntar a producción:

```bash
pg_restore --list copia.dump
createdb copa_leyendas_restore_test
pg_restore --exit-on-error --no-owner --no-privileges -d copa_leyendas_restore_test copia.dump
```

Indicar host, puerto y usuario con las opciones habituales de PostgreSQL si no son los predeterminados. Verificar tablas y cantidades de registros antes de planificar cualquier restauración productiva. No se incorpora restauración desde el panel.

La base restaurada contiene el historial tal como estaba al tomar la copia, incluido su registro en curso. El backend marca ese registro como interrumpido al arrancar; los archivos `.dump` históricos no forman parte de la propia base. Conservar la carpeta de backups aparte.
