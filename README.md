# Run Flow Run

Juego web hecho con Vite + React.

## Correrlo localmente

### Opcion 1: version ya compilada

1. Ejecuta `./run-local.bat`
2. Si prefieres PowerShell: `powershell -ExecutionPolicy Bypass -File ./run-local.ps1 -OpenBrowser`
3. El juego queda disponible en `http://localhost:4173`

### Opcion 2: modo desarrollo

Si tienes Node.js instalado:

1. Ejecuta `npm install`
2. Ejecuta `npm run dev`

## Notas

- El servidor de `run-local.ps1` sirve la carpeta `dist`.
- `vite.config.ts` usa `base: "./"` para que los proximos builds sean portables.
