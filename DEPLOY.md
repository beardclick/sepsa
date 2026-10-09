# Git y Cloudflare

## Publicación de la versión de pruebas

Esta configuración publica el frontend y la API de cuentas en Cloudflare Workers con Static Assets. Los usuarios, contraseñas, sesiones y permisos de rol se guardan en D1. Los otros registros del CRM continúan en localStorage y los PDF en IndexedDB de cada navegador.

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
5. No eliminar la publicación de Vercel hasta migrar clientes, agentes, contratos, turnos, incidentes, PDF e informes a una API compartida y probarlos desde varias cuentas. El almacenamiento local de cada navegador no se comparte con el nuevo dominio.

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
| Datos operativos | Cloudflare D1; clientes, agentes, contratos, turnos, incidentes e informes (pendiente de migrar desde localStorage) |
| Archivos | Cloudflare R2 privado; contratos PDF, evidencias e informes |
| Acceso | Autenticación en servidor y sesiones con cookies HttpOnly; autorización por rol en cada operación |
| Tiempo real | Durable Objects y WebSockets; avisos de incidentes entre dispositivos |
| Informes diarios | Cron Trigger y Worker; captura diaria idempotente por fecha de Panamá, aunque nadie abra la app |
| Versiones y publicación | GitHub y Workers Builds |

Las capas de API, D1, R2, sesiones, WebSockets y Cron todavía requieren implementación. El control de roles local actual no sustituye la autorización de la API. La migración debe importar los datos existentes y los PDF, conservar sus relaciones y comprobar los permisos con varios usuarios antes de usar datos operativos.

Documentación oficial:

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/use-cases/web-apps/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
