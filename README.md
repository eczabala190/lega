# LEGA · Gestión de legajos

App web instalable (PWA) para cargar legajos, cobros por mes y documentación (declaración jurada, recibos, otros).

## Abrir en Visual Studio Code
1. Abrí la carpeta `LEGA` en VS Code (Archivo → Abrir carpeta).
2. Instalá la extensión **Live Server**.
3. Click derecho sobre `index.html` → **Open with Live Server**.

## Estructura
- `index.html`  → pantalla base
- `css/style.css` → estilos (modo claro y oscuro)
- `js/app.js` → toda la lógica: login, legajos, cobros, documentos, usuarios, importar/exportar

## Usuarios
- Se crea un administrador inicial la primera vez que se abre la app. Cambiá su clave desde Usuarios → Clave.
- Quien toca "Crear cuenta" queda **pendiente**; el administrador la aprueba desde Usuarios y elige su rol (editor, viewer o admin).

## Importante
Los datos se guardan en el navegador de cada dispositivo (localStorage + IndexedDB). No se comparten entre celulares.
Para que las solicitudes de cuenta y los legajos lleguen al panel del administrador desde otros teléfonos, hace falta un servidor con base de datos.

## Generar el APK
- **PWABuilder**: subí la carpeta a un hosting (con HTTPS) y generá el APK en pwabuilder.com.
- **Capacitor**: `npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/android && npx cap init LEGA com.lega.app --web-dir=.` → `npx cap add android` → `npx cap open android` y compilá en Android Studio.

## Importar Excel
Desde Importar subí un .xlsx con columnas: legajo, dni, nombre, apellido, cobro, extra, ingreso, persona a cargo, telefono, estado. Si el legajo ya existe se actualiza. (Usa la librería SheetJS desde cdnjs, necesita internet la primera vez.)

## Versión web (PC y celular)
El mismo proyecto es una página web responsiva: en PC muestra menú lateral, tabla de legajos y gráficos en columnas; en celular, barra inferior y tarjetas.
Para publicarla: arrastrá la carpeta LEGA a app.netlify.com/drop (o usá Vercel / GitHub Pages) y compartí el link.
Importar → "Cargar ejemplo" carga datos de muestra para ver todo armado.

## Página de descarga para compartir
`descargar.html` es la página para compartir: detecta si entran desde Android, iPhone o PC, muestra el botón de **Descargar APK**, la dirección (URL / IP / puerto) con botón copiar, un **código QR** y botones de WhatsApp, email y compartir.
Arriba del script hay una configuración editable: `apkUrl` (dónde está el APK), `appUrl` (la app) e `ip` (opcional, para red local).

## APK automático (sin Android Studio)
Se genera en la nube con GitHub, gratis:
1. Creá una cuenta en github.com y un repositorio **público** nuevo (ej. `lega`).
2. Subí todo el contenido de esta carpeta (incluida la carpeta oculta `.github`). Si no se sube, creá a mano el archivo `.github/workflows/build-apk.yml` y pegá el contenido del que viene en el zip.
3. Entrá a la pestaña **Actions** → **Build APK** → **Run workflow**. Tarda unos 5 a 10 minutos.
4. Cuando termine, el APK queda en **Releases → apk-latest → LEGA.apk**. Link directo:
   `https://github.com/USUARIO/REPO/releases/download/apk-latest/LEGA.apk`
5. Pegá ese link en `apkUrl` dentro de `descargar.html`.
6. Subí la carpeta a **app.netlify.com/drop** y compartí el link de `descargar.html`.
El APK que sale es de prueba (firmado con clave de depuración): se instala en cualquier Android activando "instalar desde esta fuente". Para Google Play hay que firmarlo con tu propia clave.

## Compilar localmente (opcional)
`npm install` → `mkdir www && cp -r index.html css js icons manifest.webmanifest www/` → `npx cap add android` → `npx cap sync android` → `npx cap open android`.

## Servidor en red: una IP para entrar desde cualquier PC o celular
Con `servidor.js` la computadora donde lo ejecutes pasa a ser el servidor de LEGA. Cada persona entra con su propio usuario y **ve solamente sus legajos y documentos**. El administrador ve todo, puede filtrar por usuario y asignar legajos.
1. Instalá Node.js (nodejs.org, versión LTS).
2. Doble clic en `INICIAR-LEGA.bat` (Mac/Linux: `iniciar-lega.command`). Si Windows pregunta por el firewall, permití el acceso en redes privadas.
3. La ventana muestra la dirección, por ejemplo `http://192.168.1.20:8080`: esa es la IP y el puerto para entrar desde otras PC y celulares del mismo WiFi.
4. Primer ingreso: usuario `admin`, contraseña `admin`. Cambiala enseguida en Usuarios → Clave.
5. `http://TU-IP:8080/descargar.html` muestra la página para compartir con la IP real y el QR.
6. Los datos quedan en la carpeta `datos/` (hacé copias como respaldo). La PC debe estar prendida para que los demás entren.

### Usuarios y permisos
- **admin**: ve y edita los legajos de todos, filtra por usuario, asigna legajos ("Responsable"), aprueba solicitudes y administra usuarios.
- **editor**: carga y edita sus propios legajos. No ve los de otros usuarios.
- **viewer** (solo lectura): ve únicamente los legajos que el administrador le asigna.
- Quien toca "Crear cuenta" queda pendiente hasta que el administrador la aprueba y elige su rol.
- La separación la hace el servidor: un usuario no puede leer ni modificar datos o archivos ajenos aunque intente saltear la pantalla. Las contraseñas se guardan cifradas, y tras 10 intentos fallidos el ingreso se bloquea unos minutos.
- Pensado para red local. Para usarlo desde Internet, subí esta carpeta a un hosting que ejecute Node.js (Render, Railway, un VPS) y usá HTTPS.
- Sin servidor (por ejemplo en Netlify) la app funciona igual, pero guarda los datos solo en cada dispositivo.

## Si algo no anda
- **"Error: Ningún archivo encontrado" al bajar LEGA.apk**: el APK todavía no existe en la carpeta. Generalo (sección "APK automático") y guardalo con el nombre `LEGA.apk` junto a `servidor.js`. La página `descargar.html` avisa cuando falta.
- **El celular no abre la dirección**: la ventana del servidor lista varias IP. Usá la que empieza con `192.168.` o `10.` (la del WiFi); las `172.x` suelen ser redes virtuales de la PC (WSL, Docker, VPN). El celular y la PC deben estar en el mismo WiFi y el firewall de Windows debe permitir Node.js en redes privadas.
- **Sin APK, ya mismo**: abrí la dirección del servidor en Chrome del celular y elegí "Agregar a pantalla de inicio".

## APK: qué hace distinto dentro de la app de Android
En el APK, "Exportar" y "Ver" documentos usan el menú de compartir de Android (se pueden guardar en Drive, abrir con otra app o enviar por WhatsApp), y la librería de Excel se descarga al compilar para importar sin internet. Pasos completos: `PASO-A-PASO-APK.txt`.
