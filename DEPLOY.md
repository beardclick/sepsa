# Git y Cloudflare

## Publicación de la versión de pruebas

Esta configuración publica el frontend y la API de cuentas e incidentes en Cloudflare Workers con Static Assets. Usuarios, contraseñas, sesiones, roles, turnos e incidentes se guardan en D1. IncidentHub distribuye avisos entre sesiones mediante WebSockets. Los otros registros del CRM continúan en localStorage y los PDF en IndexedDB de cada navegador.

1. Crear un repositorio privado vacío en GitHub, sin README ni archivos iniciales, y compartir su URL para subir el código.
2. Entrar en Cloudflare y abrir Workers & Pages. Crear una aplicación e importar el repositorio desde GitHub. Autorizar a Cloudflare a acceder a ese repositorio.
3. Usar estos valores:

| Campo | Valor |
| --- | --- |
| Nombre del Worker | `crm-seguridad` |
| Rama de producción | `main` |
| Directorio raíz | raíz del repositorio |
| Comando de build | `npm run build` |
| Comando de deploy | `npx wrangler deploy` |

El nombre del Worker debe coincidir con `name` en `wrangler.jsonc`. Workers Builds instala las dependencias antes de compilar. Los archivos publicados salen de `dist`, según la configuración de Wrangler. Cada push a main puede generar un nuevo despliegue con la integración Git.

4. Abrir la dirección workers.dev que muestre Cloudflare. El primer acceso pide nombre, correo `info@seguridadespecializada.com`, clave de configuración y una contraseña nueva de al menos 12 caracteres. La clave de configuración se entrega al administrador por este chat. Tras configurar el primer administrador, crear las demás cuentas desde Usuarios y permisos.
5. No eliminar la publicación de Vercel hasta migrar clientes, agentes, contratos, PDF e informes a una API compartida y probarlos desde varias cuentas. El almacenamiento local de cada navegador no se comparte con el nuevo dominio.

También se puede desplegar desde un equipo autenticado:

```powershell
npm ci
npx wrangler login
npm run deploy:cloudflare
```

No guardar tokens en el repositorio. La conexión de Git en Cloudflare gestiona la autenticación del despliegue. Las credenciales de servicios que se añadan después deben configurarse como secretos del Worker.

## Stack propuesto para operación compartida

| Capa | Tecnología y responsabilidad |
| --- | --- |
| Interfaz | React, Vite y Tailwind; calendario, fichas y portal de agentes actuales |
| Hosting | Cloudflare Workers Static Assets |
| API | Cloudflare Worker; validación, operaciones y permisos en servidor |
| Datos de acceso | Cloudflare D1; usuarios, contraseñas hasheadas, sesiones y roles (ya implementado) |
| Datos operativos | Cloudflare D1; incidentes, turnos y perfiles mínimos de acceso de agentes (implementado); clientes, fichas completas de agentes, contratos e informes pendientes de migrar desde localStorage |
| Archivos | Cloudflare R2 privado; contratos PDF, evidencias e informes |
| Acceso | Autenticación en servidor y sesiones con cookies HttpOnly; autorización por rol en cada operación |
| Tiempo real | Durable Objects y WebSockets; avisos de incidentes entre dispositivos (implementado, excluye al creador) |
| Informes diarios | Cron Trigger y Worker; captura diaria idempotente por fecha de Panamá, aunque nadie abra la app |
| Versiones y publicación | GitHub y Workers Builds |

La API de usuarios e incidentes, sus permisos en servidor, D1 y los avisos WebSocket están implementados. Falta migrar las otras colecciones operativas y los PDF a D1/R2, y añadir Cron para informes con la app cerrada. Las migraciones D1 se aplican con `npx wrangler d1 migrations apply crm-seguridad-db --remote` antes de desplegar. La configuración fija la cuenta de info@seguridadespecializada.com para evitar publicaciones en otras cuentas.

Para la prueba de integración local, aplicar migraciones con `--local`, crear `.dev.vars` (ignorado por Git) con `BOOTSTRAP_ADMIN_EMAIL=admin@example.com` y `BOOTSTRAP_SETUP_KEY=local-integration-only`, iniciar `npx wrangler dev --port 8787` y ejecutar `node tests/cloud-incidents.integration.mjs`. La prueba crea y elimina datos solo en el D1 local.

Documentación oficial:

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/use-cases/web-apps/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

Al crear un agente, se solicita correo y contraseña inicial y se crea automáticamente su usuario con rol Agentes y su ficha vinculada. El agente entra directamente a Mis incidentes; el menú administrativo no muestra ese acceso.
