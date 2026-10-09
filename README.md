# SEPSA CRM

CRM de seguridad en React y Vite. Ejecuta `npm install` y `npm run dev`. Compilación: `npm run build`. Pruebas: `npm test`.

Publicación en Cloudflare y stack propuesto: [DEPLOY.md](DEPLOY.md). La configuración actual publica únicamente el frontend de pruebas.

## Accesos

La primera apertura solicita establecer una contraseña para el usuario `admin`. En Usuarios y permisos se pueden crear usuarios, asociarlos con agentes, desactivar accesos y administrar roles. Roles iniciales: Administradores, Jefes de seguridad, Supervisores y Agentes. Cada módulo tiene permisos de ver, crear, editar y eliminar. El rol Administradores conserva el control de usuarios para evitar perder acceso. Los catálogos que están en uso requieren reasignar sus registros antes de eliminarlos.

El agente entra con su propio usuario y registra incidentes desde Mis incidentes. El sistema vincula cada incidente a su identidad y puesto, con la fecha seleccionada y estado Abierto.

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
- Los incidentes se guardan en D1 y se comparten entre dispositivos. Los usuarios conectados con permiso de ver incidentes (administradores, jefes y supervisores) reciben un toast mediante WebSockets y Durable Objects; el creador queda excluido del aviso y ve la confirmación de envío. El toast dura ocho segundos y el aviso permanece en la campana durante la sesión. El historial inicial, las importaciones y las ediciones no generan avisos nuevos. La conexión se recupera automáticamente y se comprueba el historial cada veinte segundos como respaldo.
- El portal consulta solo los incidentes del agente asociado. El servidor fija el reportante, el puesto y el creador del incidente. La asociación mínima de nombre y puesto se comparte al crear o editar el usuario. Los incidentes reales creados localmente antes de esta actualización se importan al abrir el mismo navegador, según los permisos; se conserva una copia en localIncidentArchive y se excluyen los ejemplos de la plantilla.

## Persistencia y límites

Las cuentas reales, contraseñas, sesiones y roles se guardan en Cloudflare D1. La contraseña se verifica en el servidor y el navegador recibe una cookie de sesión HttpOnly. La clave de configuración inicial solo permite crear el primer administrador y la cuenta queda cerrada después de ese registro. El administrador puede crear usuarios desde Usuarios y permisos.

Los incidentes y sus evidencias comprimidas se guardan en D1. Clientes, fichas completas de agentes, contratos, equipos e informes permanecen en localStorage bajo la clave existente. Los PDF se guardan en IndexedDB y se incluyen en los respaldos JSON de Ajustes. Esas colecciones todavía no se comparten entre dispositivos.

La API valida en servidor los permisos de usuarios, roles, turnos e incidentes. Los permisos de las otras colecciones operativas aún se aplican en la interfaz local. La generación de informes con la aplicación cerrada sigue pendiente. Los informes anteriores conservan la captura guardada: no reconstruyen datos históricos de inventario o personal.

Los turnos se guardan en D1 y se consultan cada quince segundos. El agente recibe solo sus propios turnos y ve junto al saludo el tiempo restante con segundos, calculado en la zona de Panamá, incluidos los turnos nocturnos. Los turnos reales locales se importan una sola vez desde el navegador administrativo y se respaldan en localShiftArchive. Los estados de sus incidentes se actualizan automáticamente cada veinte segundos. La eliminación se abre desde los formularios de edición; Usuarios y permisos muestra cuentas y roles administrativos, y los accesos de agentes se gestionan en sus fichas.

La app espera la validación de la sesión antes de mostrar el panel o el formulario de acceso. Al navegar entre secciones, recuperar el foco o cada treinta segundos con la pestaña visible, consulta la cuenta y sus permisos actuales. Actualiza usuarios y roles, y solicita una nueva lectura de incidentes y turnos. Una sesión revocada cierra el panel; los errores temporales de red conservan la sesión y muestran un aviso para reintentar. Los demás módulos conservan el almacenamiento local descrito anteriormente.
