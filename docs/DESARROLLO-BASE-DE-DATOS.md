# Base de datos local para desarrollo

Este procedimiento migra PostgreSQL local y carga registros ficticios para probar el panel, la agenda, las reservas públicas, los pagos y el inventario.

## Protección y alcance

- Solo se conecta a `localhost`, `127.0.0.1` o `::1`.
- Requiere habilitar expresamente `SALON_ALLOW_DEV_SEED=1` para cargar los datos.
- No se ejecuta con `NODE_ENV=production` ni contra bases cuyo nombre incluya `prod` o `production`.
- La carga completa corre en una transacción. Si una operación falla, se revierten los inserts y actualizaciones de ese intento.
- Los IDs de los registros incluyen el prefijo `dev-demo-`. Volver a ejecutar el seed actualiza esos fixtures, sin borrar datos.
- No crea cuentas, sesiones, contraseñas ni invitaciones. Tampoco reemplaza los ajustes de un salón que ya exista.
- No uses estos fixtures en producción ni conectes el seed a una base remota.

## Base nueva

1. Configura `DATABASE_URL` en `.env` con una base PostgreSQL local vacía.
2. Ejecuta las migraciones y la carga:

   ```powershell
   $env:SALON_ALLOW_DEV_SEED = "1"
   pnpm db:setup:dev
   Remove-Item Env:SALON_ALLOW_DEV_SEED
   ```

`db:setup:dev` ejecuta primero `pnpm db:migrate` y luego `pnpm db:seed:dev`. Si la migración falla, el seed no se ejecuta. La variable de autorización se elimina al terminar; si el comando se interrumpe, puede quitarse manualmente con `Remove-Item Env:SALON_ALLOW_DEV_SEED`.

## Base local que ya tiene el esquema

Inspecciona primero el destino. Para un esquema existente con el baseline de la aplicación, usa la reconciliación segura antes de cargar los fixtures:

```powershell
pnpm db:preflight
pnpm db:migrate:safe
$env:SALON_ALLOW_DEV_SEED = "1"
pnpm db:seed:dev
Remove-Item Env:SALON_ALLOW_DEV_SEED
```

`db:migrate:safe` puede rechazar bases cuyo esquema o historial no coincida con el baseline; no intentes resolver esa situación con `db:push` sin revisar el diff.

## Datos incluidos

El paquete agrega o actualiza solo registros identificados por `dev-demo-`:

- 3 categorías, 4 servicios y 3 técnicas ficticias.
- 2 profesionales demo, sus servicios asignados y horarios de lunes a viernes.
- 4 clientas con datos reservados para pruebas (`example.invalid` y teléfonos ficticios).
- 3 insumos, sus relaciones con servicios y movimientos iniciales de inventario.
- 3 turnos: uno completado de la semana anterior, uno confirmado para el próximo día hábil y uno pendiente para el siguiente día hábil. Se incluyen sus detalles históricos y pagos de ejemplo.
- Un ajuste de salón por defecto solo si todavía no existe ninguno.

Las fechas de los turnos se calculan en `America/Argentina/Buenos_Aires` al ejecutar el seed. Sus IDs son estables, por lo que repetir la carga actualiza los tres turnos y evita generar duplicados. Los dos turnos futuros usan profesionales distintas.

## Acceso al panel

El paquete no contiene credenciales de demostración. Crea la primera cuenta administrativa con el flujo de registro y el `SALON_SETUP_TOKEN` configurado localmente; el token es independiente del permiso para cargar fixtures. No agregues contraseñas de prueba al repositorio.

Después puedes iniciar la aplicación con `pnpm dev`, revisar `/` y probar las reservas en `/reservar`. Los cambios que realices sobre las filas `dev-demo-` se volverán a aplicar al ejecutar el seed.
