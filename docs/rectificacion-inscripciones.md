# Rectificar una inscripción

En **Inscripciones → Equipos habilitados**, Dirección puede seleccionar **Rehabilitar para rectificar** para un token usado. Se conserva el mismo token y enlace; su estado visible pasa a **Para rectificar**. Dirección puede copiarlo o volver a enviarlo por WhatsApp y también revocar el acceso mientras está habilitado.

El enlace carga los datos existentes, incluidas las marcas y talles. Permite corregirlos y agregar la tercera jugadora / suplente. Las fotos y el comprobante muestran el nombre del archivo ya cargado y se conservan si no se adjunta un reemplazo.

Al guardar se actualiza la misma inscripción, conservando su ID, fecha de alta, estado, notas internas, bonificación, modalidad de pago y arancel por jugadora. Las referencias desde zonas y partidos permanecen vinculadas. Se actualizan las jugadoras del padrón por DNI y se crean las nuevas. Una corrección de DNI conserva el ID de la jugadora anterior cuando esa identidad no sigue utilizada en otra inscripción o posición del equipo.

La inscripción y la sincronización de jugadoras se guardan en una transacción; si falla la rectificación, el token sigue disponible y no se modifica la inscripción. El token vuelve a **Usado** al completar el envío. Se bloquea la fila del token para impedir que dos envíos simultáneos dupliquen registros.

Solo un token activo devuelve el formulario previo. La respuesta pública excluye notas internas e identificadores de almacenamiento y lleva `Cache-Control: no-store`.

No requiere migración: utiliza `ACTIVE` junto con la inscripción existente y conserva `consumedAt` para identificar los tokens rehabilitados en Dirección.

Validación: pruebas de `registrations.service.spec.ts` y `RegistrationPage.test.ts`, más `node scripts/verify-registration-corrections.cjs` después del build del backend. Esta última crea y elimina una base PostgreSQL local de prueba; verifica rectificación, suplente, archivos conservados, identidad por DNI, envíos simultáneos y rollback.
