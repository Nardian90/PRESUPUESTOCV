# PRESUPUESTO CCTV

**Sistema Profesional de Presupuestación Técnica y Comercial**

Plataforma web para proyectos de CCTV, videovigilancia IP, telecomunicaciones,
corrientes débiles y redes: gestión integral de equipos, materiales, software,
mano de obra, transporte y propuestas comerciales con PDF técnico y comercial.

---

## Acceso al sistema

- La aplicación abre con un **login profesional por contraseña** (sin usuario ni registro).
- **Contraseña inicial:** la definida por el propietario del sistema (cámbiala tras el primer acceso).
- La contraseña **nunca se guarda en texto plano**: se compara su hash **SHA-256**.
- Sesión persistente de **12 horas**. Cierre de sesión desde el menú lateral ("Cerrar sesión").
- Todas las secciones están protegidas: sin sesión activa solo es visible el login.
- Para cambiar la contraseña: **Configuración Económica → Seguridad de acceso**.

## Instalación y ejecución

No requiere servidor, dependencias ni compilación:

```bash
# Opción 1: abrir directamente
doble clic en index.html

# Opción 2: servir localmente
python3 -m http.server 8080   # → http://localhost:8080
```

También funciona publicada como sitio estático (GitHub Pages, Netlify, etc.).

### Variables de entorno

En modo estático no son obligatorias. Para despliegues con servidor, use
`.env.example` como plantilla (sin secretos reales):

```bash
cp .env.example .env   # defina APP_PASSWORD y AUTH_MODE=server
```

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla (sin dependencias) |
| Temas | Sistema de diseño con tokens CSS (`--*`) · Light / Dark persistente |
| Auth | SHA-256 en JS puro (compatible con `file://`) + sesión en localStorage |
| Persistencia | localStorage con autoguardado e indicador "✓ Cambios guardados" |
| PDFs | Generación por impresión (motor CSS de impresión, portada propia) |
| Responsive | Mobile First · breakpoints 640 / 768 / 1024 / 1440 / 1920 px |

```
index.html    → shell (login + sidebar + 15 secciones)
styles.css    → sistema de diseño, temas, responsive, impresión
js/data.js    → datos semilla (partidas, software, MO, transporte, auditoría)
js/auth.js    → autenticación (SHA-256), sesión, tema claro/oscuro
js/app.js     → motor económico, renders, validaciones, PDFs, exportaciones
```

## Secciones

1. **Dashboard** — 9 KPIs, indicadores, ficha RESUMEN DE OFERTA, fórmula en vivo, clasificación A–J.
2. **Datos del Proyecto** — información general + **Responsable (opcional)** + observaciones.
3. **Equipos y Materiales** — partidas editables con grado A/B/C/D, fuente, URL, disponibilidad.
4. **Software CCTV** — con valor económico o gratuito justificado (nombre, licencia, precio, fuente).
5. **Mano de Obra** — 29 operaciones en 7 categorías (Ingeniería, Instalación, Redes, Configuración, Commissioning, Pruebas, Capacitación) con Cantidad × Precio Unitario.
6. **Transporte** — opcional (interruptor): lista de gastos + 5 modos (fijo, %, viaje, km, manual).
7. **Configuración Económica** — impuesto (11% por defecto), utilidad (30% por defecto), seguridad, respaldo.
8. **Resumen para Cliente** — vista comercial sin costos internos.
9. **Validación Técnica** — análisis PoE/banda/almacenamiento + 16 validaciones + máquina de estados.
10. **Fuentes de Precios** — trazabilidad completa y cobertura A/B con filtros.
11. **Análisis de Mercado** — distribución por grados, fuentes, alertas y costos por cámara.
12. **Sustituciones** — equivalencias documentadas con estado de aprobación.
13. **Auditoría Interna** — hallazgos y resoluciones.
14. **PDF Técnico** — portada + 14 secciones internas (con fuentes y costos).
15. **PDF Comercial** — documento para el cliente (sin URLs, costos ni márgenes).

## Regla del responsable (dinámico)

El responsable del presupuesto **no está predefinido** y **no viene con ningún
nombre fijo**: se introduce libremente en *Datos del Proyecto → Responsable*
(Elaborado por, Cargo, Empresa, Teléfono, Correo).

- Todos los campos son **opcionales** y pueden borrarse en cualquier momento.
- En los PDFs **solo aparecen los campos que tengan información**; los vacíos
  se ocultan completamente (nunca se imprime "Elaborado por:" vacío).

## Fórmula económica (por defecto)

```
Equipos + Materiales + Software + Mano de Obra + Transporte = COSTO DIRECTO
COSTO DIRECTO + UTILIDAD (30% sobre costo)                  = SUBTOTAL DE VENTA
SUBTOTAL DE VENTA + IMPUESTO (11%)                          = TOTAL DE OFERTA
```

Ambos porcentajes son editables (0 / 5 / 11 / 15 / personalizado).

**Valores de referencia v2.0** (se recalculan en vivo): Equipos 4,015.67 ·
Materiales 797.48 · Software 0.00 · Mano de obra 3,389.50 → **Costo directo
8,202.65** · Utilidad (30%) 2,460.79 → **Subtotal de venta 10,663.44** ·
Impuesto (11%) 1,172.98 → **Total de oferta ≈ USD 11,836.42**.

## Máquina de estados

`BORRADOR → REVISIÓN TÉCNICA → REVISIÓN COMERCIAL → LISTO PARA CLIENTE`

- Revisión Técnica: PoE, puertos, ancho de banda y retención OK.
- Revisión Comercial: cobertura A/B ≥ 90%.
- Listo para Cliente: **16 validaciones aprobadas** (incluye cobertura = 100%).

## Respaldo de datos

- Autoguardado permanente en el navegador + indicador de última modificación.
- **Respaldo JSON** (exportar/importar) y **Exportar CSV** desde Dashboard o Configuración.
- Opción "Restablecer datos semilla" en Configuración Económica.
