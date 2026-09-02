# PRESUPUESTO CCTV PRO

Aplicación web 100% local (HTML + CSS + JS, sin dependencias) para auditar, calcular y
entregar el presupuesto del proyecto:

> **PROYECTO EJECUTIVO — CORRIENTES DÉBILES — TAVS / CCTV**
> Supermercado 23 y 10 · Calle 23 e/ 10 y 12
> Elaborado por: Ing. Cecilio A. Sáez N.

## Cómo usar

1. Abrir `index.html` en cualquier navegador moderno (doble clic; no requiere servidor ni internet).
2. Todo se guarda automáticamente en el navegador (localStorage).
3. Botones superiores: **Guardar**, **Exportar CSV**, **Respaldo JSON**, **Importar JSON**,
   **Imprimir / PDF Técnico**, **Imprimir / PDF Cliente** (elegir "Guardar como PDF" en el diálogo).

## Módulos

| Módulo | Contenido |
|---|---|
| Dashboard | Configuración económica (impuesto, utilidad, transporte), parámetros técnicos (PoE, ancho de banda, almacenamiento), fórmula oficial en vivo y clasificación A–J |
| Equipos | 22 partidas editables (21 cámaras 4MP, NVR 32ch, 2×6TB WD Purple facturadas, UPS, cableado, etc.) con grado de precio A/B/C/D, fuente, URL y disponibilidad |
| Mano de Obra | 29 operaciones en 3 niveles (Técnico / Supervisor / Ingeniero) con tarifas editables |
| Auditoría | 20 hallazgos (NVR sustituido, HDD facturado, MCB 6A con precio real, proveedor dudoso excluido, iVMS-4200 justificado, etc.) |
| Validaciones | 16 verificaciones (10 automáticas) que habilitan el estado LISTO PARA CLIENTE |
| Vista Cliente | Cotización sin URLs, sin costos internos y sin márgenes |

## Reglas económicas (fórmula oficial)

```
COSTO DIRECTO → UTILIDAD (CD × 30%) → SUBTOTAL → IMPUESTO (× 11%) → PRECIO FINAL
```

- Impuesto por defecto **11%** (editable: 0 / 5 / 11 / 15 / personalizado).
- Utilidad por defecto **30% MARKUP SOBRE COSTO** (conmutable a margen sobre precio).
- Transporte **desactivado por defecto**, 5 modos (fijo, %, por viaje, por km, manual).
- Cobertura de precios: verde 100% · amarillo 90–99% · rojo <90%.
- **Puerta de entrega**: sin 100% de cobertura A/B y 16 validaciones no se puede marcar LISTO PARA CLIENTE.

## Máquina de estados

`BORRADOR → REVISIÓN TÉCNICA → REVISIÓN COMERCIAL → LISTO PARA CLIENTE`

- A REVISIÓN TÉCNICA: PoE, puertos, ancho de banda y retención OK.
- A REVISIÓN COMERCIAL: cobertura A/B ≥ 90%.
- A LISTO PARA CLIENTE: las 16 validaciones aprobadas (incluye cobertura = 100%).

## Valores de referencia v1

Costo directo ≈ **USD 8,292.65** (equipos 4,813.15 + mano de obra 3,479.50) ·
Utilidad 30% = 2,487.80 · Subtotal = 10,780.45 · Impuesto 11% = 1,185.85 ·
**Precio final ≈ USD 11,966.29** (los valores se recalculan en vivo con cada edición).

## Estructura

```
index.html    → interfaz
styles.css    → tema azul corporativo minimal claro + impresión
js/data.js    → datos semilla (partidas, MO, auditoría, validaciones)
js/app.js     → lógica, cálculos, exportaciones, máquina de estados
```
