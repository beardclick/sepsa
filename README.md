# SEPSA CRM

CRM de seguridad en React y Vite. Ejecuta `npm install` y `npm run dev`. Compilación: `npm run build`. Pruebas: `npm test`.

Publicación en Cloudflare y stack propuesto: [DEPLOY.md](DEPLOY.md). La configuración actual publica únicamente el frontend de pruebas.

## Accesos

La primera apertura solicita establecer una contraseña para el usuario `admin`. En Usuarios y permisos se pueden crear usuarios, asociarlos con agentes, desactivar accesos y administrar roles. Roles iniciales: Administradores, Jefes de seguridad, Supervisores y Agentes. Cada módulo tiene permisos de ver, crear, editar y eliminar. El rol Administradores conserva el control de usuarios para evitar perder acceso. Los catálogos que están en uso requieren reasignar sus registros antes de eliminarlos.

El agente entra con su propio usuario y registra incidentes desde el Portal del agente. El sistema vincula cada incidente a su identidad y puesto, con fecha actual y estado Abierto.

## Operación

- Equipos tiene un submenú de categorías y un filtro por categoría. En la sección Equipo asignado de la ficha del agente se pueden crear y editar equipos sin salir de esa ficha. No hay una sección de dotación separada.
- Contratos tiene un submenú de tipos de servicios y permite adjuntar varios PDF de hasta 20 MB cada uno. Renombrar un servicio actualiza sus contratos y prospectos.
- Los clientes se ubican con un marcador en un mapa, centrado por defecto en David, Chiriquí.
- En Agentes → ficha del agente → Turnos → Programar semanas, o desde Calendario, se crean varios turnos con días y horarios independientes para esta semana y la próxima. Hay selección rápida Lun–Vie y Mar–Sáb, vista previa de fechas, detección de solapamientos (incluidos nocturnos) y opción explícita para omitir conflictos. La creación se guarda como un solo lote.
- El dashboard limita Agentes por entrar y su contador a los turnos que empiezan dentro de las próximas 48 horas.
- Las fechas se presentan como dd/mm/aa y las horas como hh:mm AM/PM. Los valores internos ISO y de 24 horas se conservan para calcular turnos.
- Informes permite seleccionar secciones, añadir comentarios, revisar el historial y descargar PDF paginados. Incidentes y turnos se filtran por el día elegido; las otras secciones reflejan el inventario y personal existentes al generar la captura. Un informe diario automático se crea al abrir la app o cambiar de día, usando la zona America/Panama. Se puede actualizar al cierre del día. Las preferencias incluyen secciones y comentarios para los informes siguientes.
- El formulario de informes se abre desde el botón Generar informe. Si ya existe un informe para la fecha elegida, se muestra una advertencia y se exige confirmar su actualización antes de reemplazarlo.
- Solo se mantiene abierto un submenú lateral a la vez, tanto en escritorio como en móvil.
- Todas las secciones de registros relacionados permiten crear y editar en contexto según los permisos. Al abrir una ficha relacionada, los enlaces guardan el origen: guardar, cancelar la edición, eliminar o usar Volver regresa a la ficha anterior. Las fichas abiertas directamente siguen regresando a su listado.
- Los nuevos incidentes muestran un toast durante ocho segundos y permanecen en la campana de notificaciones durante la sesión. Los incidentes existentes al entrar y las ediciones no generan avisos. Los avisos respetan los permisos: los agentes ven solo sus propios incidentes. Los cambios se sincronizan de inmediato entre pestañas del mismo navegador mediante el evento storage; las notificaciones entre dispositivos requieren un backend compartido.

## Persistencia y límites

Los registros permanecen en localStorage bajo la clave existente; la migración conserva las colecciones operativas, agrega categorías y elimina la colección de facturas. Los PDF se guardan en IndexedDB y se incluyen en los respaldos JSON de Ajustes. Los respaldos de usuarios sin acceso a todos los módulos contienen solo los datos autorizados; para restaurar un respaldo completo debe exportarlo un administrador con acceso a todos los módulos.

Esta versión no tiene backend. Las cuentas y los permisos controlan la interfaz y sus operaciones locales; no constituyen una barrera de seguridad frente a alguien con acceso al almacenamiento o herramientas de desarrollo del navegador. Las contraseñas usan PBKDF2 con sal y 210000 iteraciones, pero la autenticación compartida, autorización en servidor, sincronización entre dispositivos y generación de informes con la aplicación cerrada requieren un backend y un programador de tareas. Los informes anteriores conservan la captura guardada: no reconstruyen datos históricos de inventario o personal.
