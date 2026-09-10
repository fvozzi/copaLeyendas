# Plantilla de inscripción por WhatsApp

El botón **Enviar WhatsApp** usa una plantilla para poder iniciar la conversación sin que el contacto tenga que escribir primero. La plantilla debe estar aprobada en la misma cuenta de WhatsApp Business a la que pertenece el número emisor. La entrega sigue dependiendo de Meta y del destinatario.

## Crear en Meta

En **Administrador de WhatsApp → Plantillas de mensajes → Crear plantilla**:

- Nombre: `inscripcion_copa_leyendas`.
- Idioma: **Español (Argentina)**, código `es_AR`.
- Categoría propuesta: **Utilidad**, para continuar una solicitud de inscripción ya recibida del equipo. Meta decide la categoría y aprobación definitivas.
- Tipo: texto, con variables **numéricas/posicionales** en el cuerpo.
- Sin encabezado, pie ni botones. El enlace completo va en la cuarta variable del cuerpo.

Copiar este cuerpo exactamente:

```text
Hola {{1}},

Recibimos la solicitud de inscripción del equipo {{2}} para la categoría {{3}} de Copa Leyendas.

Para continuar con esa solicitud, completá los datos de las jugadoras en el formulario:
{{4}}

Gracias por completar los datos de tu equipo.
```

Completar los ejemplos que pide Meta:

| Variable | Contenido | Ejemplo |
| --- | --- | --- |
| `{{1}}` | Nombre del contacto | Facundo |
| `{{2}}` | Equipo / localidad | Junin |
| `{{3}}` | Categoría | Damas A |
| `{{4}}` | Enlace completo de inscripción | `https://copaleyendas.com.ar/inscripcion?token=COPA-EJEMPLO1` |

El código del ejemplo es ficticio. En los envíos reales, el backend toma el token del equipo y arma el enlace automáticamente.

Mantener una URL de ejemplo representativa en la cuarta variable: el mensaje real contiene un enlace. Si Meta sigue recomendando Autenticación para este seguimiento de inscripción, solicitar la revisión de la clasificación desde la ayuda para empresas. La redacción no garantiza aprobación.

Enviar la plantilla a revisión y esperar el estado **Aprobada**. Crear la plantilla en el panel no cambia por sí solo los envíos de la aplicación: también hay que desplegar este cambio del backend.

## Configuración del backend

El nombre y el idioma anteriores son los valores por defecto; si se usan exactamente esos valores, no hace falta agregar variables al servidor. Para usar otro nombre o traducción aprobados, configurar:

```env
WHATSAPP_REGISTRATION_TEMPLATE_NAME=inscripcion_copa_leyendas
WHATSAPP_REGISTRATION_TEMPLATE_LANGUAGE=es_AR
```

El nombre y el idioma deben coincidir con Meta. Una plantilla creada en `es` no es la traducción `es_AR`. Al cambiar variables del entorno, reiniciar el backend.

La plantilla debe conservar cuatro parámetros de cuerpo, en el orden contacto, equipo, categoría y enlace. No se usa un mensaje de texto libre como alternativa cuando falla la plantilla: podría volver a fallar fuera de la ventana de 24 horas.

## Crear mediante API, si se administra la cuenta desde el servidor

[whatsapp-registration-template.json](./whatsapp-registration-template.json) contiene el cuerpo listo para `POST /{WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`. El identificador es el de la cuenta WABA, no el del teléfono. Esta operación requiere un token con el permiso de administración correspondiente; no envía mensajes a contactos.

## Verificación

1. Confirmar **Aprobada** en Meta y desplegar el backend.
2. Seleccionar un equipo activo cuyo contacto haya aceptado recibir la comunicación de inscripción.
3. Pulsar **Enviar WhatsApp** y comprobar la recepción y el enlace desde ese celular.
4. Si Meta acepta el pedido pero no llega, revisar los estados y errores del webhook en el backend. **Último WhatsApp** registra aceptación, no entrega.

Referencias: [reglas de conversación de WhatsApp](https://whatsappbusiness.com/policy/), [envío de plantillas de texto — Meta](https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text), [creación de plantillas — Meta](https://www.postman.com/meta/whatsapp-business-platform/request/3o32lzu/create-template-w-location-header-text-body-text-footer-and-a-website-buttons).
