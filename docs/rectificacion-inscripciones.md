# Rectificar una inscripción

En **Inscripciones → Equipos habilitados**, Dirección puede seleccionar **Rehabilitar para rectificar** para un token usado. Se conserva el mismo token y enlace; su estado visible pasa a **Para rectificar**. Dirección puede copiarlo o volver a enviarlo por WhatsApp y también revocar el acceso mientras está habilitado.

El enlace carga los datos existentes, incluidas las marcas y talles. Permite corregirlos y agregar la tercera jugadora / suplente. Las fotos se conservan si no se adjunta un reemplazo. Los comprobantes anteriores se conservan siempre.

Si se agrega una suplente a una inscripción no bonificada, se exige un comprobante nuevo por el arancel de esa jugadora, incluso si la inscripción original tenía pago diferido. Las bonificadas no requieren comprobante. Rectificar datos sin aumentar la cantidad de jugadoras no exige otro pago. Si ya se registró el pago de la tercera plaza, quitarla y volver a agregarla no vuelve a cobrarla.

Cada comprobante se guarda en `registration_payments` con su importe, cantidad de jugadoras, tipo y fecha. Inscripciones permite abrir el inicial y los adicionales por separado. Caja suma estos importes guardados, con una fila por pago, sin recalcular el ingreso inicial al cambiar la nómina. Un comprobante actualizado adjuntado sin sumar jugadoras se conserva con importe cero y no duplica ingresos. Los nuevos pagos se guardan en la misma transacción que la rectificación; los envíos simultáneos tampoco duplican pagos.

Al guardar se actualiza la misma inscripción, conservando su ID, fecha de alta, estado, notas internas, bonificación, modalidad de pago y arancel por jugadora. Las referencias desde zonas y partidos permanecen vinculadas. Se actualizan las jugadoras del padrón por DNI y se crean las nuevas. Una corrección de DNI conserva el ID de la jugadora anterior cuando esa identidad no sigue utilizada en otra inscripción o posición del equipo.

La inscripción y la sincronización de jugadoras se guardan en una transacción; si falla la rectificación, el token sigue disponible y no se modifica la inscripción. El token vuelve a **Usado** al completar el envío. Se bloquea la fila del token para impedir que dos envíos simultáneos dupliquen registros.

Solo un token activo devuelve el formulario previo. La respuesta pública excluye notas internas e identificadores de almacenamiento y lleva `Cache-Control: no-store`.

Desplegar backend y frontend con la migración `1790035200000-AddRegistrationPayments`. Copia los comprobantes previos y congela sus importes tal como Caja los calculaba al migrar, sin inventar pagos adicionales históricos. El backend aplica las migraciones al iniciar con `DB_SYNCHRONIZE=false`. El acceso sigue usando `ACTIVE` y conserva `consumedAt` para identificar los tokens rehabilitados en Dirección.

Validación: pruebas de `registrations.service.spec.ts` y `RegistrationPage.test.ts`, más `node scripts/verify-registration-corrections.cjs` después del build del backend. Esta última crea y elimina una base PostgreSQL local de prueba; verifica rectificación, suplente, archivos conservados, identidad por DNI, envíos simultáneos y rollback.
