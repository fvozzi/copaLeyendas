# Caja: efectivo y proyecciones

Los pagos de inscripción con importe positivo aparecen automáticamente como ingresos efectivos y conservan el comprobante de la inscripción. Los ingresos manuales permiten registrar auspiciantes, donaciones y otros conceptos sin crear una inscripción ficticia.

Los ingresos manuales y egresos se pueden crear como **Proyectados** o **Efectivos**, editar y pasar a efectivos cuando se cobra o paga. La fecha prevista es opcional; al efectivizar se guarda la fecha de cobro o pago, inicialmente la del día en Argentina. Las inscripciones no se editan desde Caja.

Los tres indicadores muestran únicamente montos efectivos. El gráfico compara esos montos con el total que resultaría al efectivizar todos los movimientos proyectados. El saldo proyectado suma ingresos efectivos y proyectados, y resta egresos efectivos y proyectados. Las pestañas separan los listados de ingresos y egresos.

La migración `1790208000000-ProjectCashMovements` conserva los egresos existentes como efectivos y usa su fecha de creación como fecha de pago. No duplica ingresos de inscripciones.
