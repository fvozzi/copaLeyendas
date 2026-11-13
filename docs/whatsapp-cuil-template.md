# Plantilla de WhatsApp para solicitar CUIL

El envío masivo desde **Inscripciones → Equipos habilitados → Enviar pedido de CUIL** necesita una plantilla de utilidad aprobada en Meta.

- Nombre: `solicitud_cuil_copa_leyendas`
- Idioma: `es_AR`
- Categoría: `UTILITY`
- Definición lista para copiar: [`whatsapp-cuil-template.json`](./whatsapp-cuil-template.json)

Variables del cuerpo, en este orden:

| Variable | Contenido |
| --- | --- |
| `{{1}}` | Nombre del contacto |
| `{{2}}` | Equipo o localidad |
| `{{3}}` | Enlace completo al formulario de CUIL |

Si Meta aprueba otro nombre o idioma, configurarlos en `WHATSAPP_CUIL_TEMPLATE_NAME` y `WHATSAPP_CUIL_TEMPLATE_LANGUAGE`.

El sistema sólo envía a equipos con una inscripción, al menos una jugadora sin CUIL, teléfono de contacto y token no revocado. Los mensajes se procesan en lotes de cinco y un error no interrumpe los demás envíos.
