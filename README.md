# LUiv

Aplicación estática para gestionar ventas, gastos y productos. Los datos se conservan en el navegador mediante `localStorage`; no se usan variables de entorno ni una base de datos remota.

## Ejecutar localmente

Abrí el proyecto mediante un servidor estático (necesario para probar la PWA). Por ejemplo, con Node.js instalado:

```powershell
npx serve .
```

Después abrí la dirección que muestre el comando. Para instalarla, usá la opción **Instalar aplicación** del navegador (Chrome/Edge) cuando se sirva por HTTPS o desde `localhost`.

## Deployment

Se recomienda Netlify porque la aplicación no necesita compilación ni servidor. Importá el repositorio o arrastrá la carpeta del proyecto; la configuración `netlify.toml` publica la raíz. Netlify entrega HTTPS y asigna una URL como `https://nombre-del-sitio.netlify.app` que podés compartir. También se puede publicar en Cloudflare Pages o GitHub Pages como sitio estático.

No hay variables de entorno necesarias. Importante: los datos son locales a cada navegador/dispositivo. Para compartir datos entre personas se requeriría, en una etapa futura, un backend y autenticación.
