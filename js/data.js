/* =========================================================
   PRESUPUESTO CCTV PRO — data.js (datos semilla v2.0)
   El responsable del presupuesto NUNCA está predefinido:
   se introduce libremente por el usuario en "Datos del Proyecto".
   ========================================================= */

const CATS = {
  A:'A · Equipos CCTV', B:'B · Redes', C:'C · Eléctrico',
  D:'D · Materiales / Obra', E:'E · Software', F:'F · Mano de obra',
  G:'G · Transporte', H:'H · Otros', I:'I · Utilidad', J:'J · Impuestos'
};

const PROJECT_META = {
  nombre:'PROYECTO EJECUTIVO — CORRIENTES DÉBILES — TAVS / CCTV',
  obra:'',
  direccion:'Supermercado 23 y 10 · Calle 23 e/ 10 y 12',
  cliente:'',
  especialidad:'Corrientes Débiles / TAVS — CCTV',
  numPresupuesto:'',
  fecha:new Date().toISOString().slice(0,10),
  vigencia:'30 días',
  moneda:'USD',
  observaciones:'',
  responsable:{ nombre:'', cargo:'', empresa:'', telefono:'', correo:'' }
};

const CONFIG = {
  taxPct:11,
  markupMode:'costo',        // 'costo' = MARKUP SOBRE COSTO (oficial) | 'precio' = margen sobre venta
  markupPct:30,
};

const RATES = { T:28, S:45, I:65 };  // tarifas de referencia USD/h (Técnico / Supervisor / Ingeniero)

const TECH = {
  bitrateMbps:4, camWatts:6.5,
  nvrCanal:32, nvrPoePorts:16, nvrPoeBudget:170,
  swPoePorts:8, swPoeBudget:64,
  nvrBwMbps:256, hddTB:12, retencionDias:10
};

/* Cat. A/B = Equipos · Cat. C/D/H = Materiales */
const EQUIPMENT = [
 {id:'EQ-01', cat:'A', code:'CAM-DOM-01', desc:'Cámara Domo IP Hikvision 4MP DS-2CD3346WDV3-I (H.265+, WDR, IR 30 m, PoE)', qty:1, unit:'pza', cost:104.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=DS-2CD3346WDV3-I', stock:'EN STOCK', note:'4MP · domo del alcance original'},
 {id:'EQ-02', cat:'A', code:'CAM-BUL-20', desc:'Cámara Bullet IP Hikvision 4MP DS-2CD3T46WDV3-I3 (H.265+, EXIR 40 m, PoE, IP67)', qty:20, unit:'pza', cost:89.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=DS-2CD3T46WDV3-I3', stock:'EN STOCK', note:'Precio unitario por volumen; validar listado exacto al comprar'},
 {id:'EQ-03', cat:'A', code:'NVR-01', desc:'NVR IP Hikvision 32 canales DS-7732NI-K4/16P (16 PoE, 2 SATA hasta 10 TB c/u, H.265+)', qty:1, unit:'pza', cost:479.00, grade:'B', source:'Distribuidor autorizado', url:'https://www.amazon.com/s?k=DS-7732NI-K4%2F16P', stock:'EN STOCK', note:'Sustituye al DS-7932N-K4 original — ver Sustituciones'},
 {id:'EQ-04', cat:'A', code:'HDD-01', desc:'Disco duro de vigilancia WD Purple 6 TB (WD62PURZ)', qty:2, unit:'pza', cost:124.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=WD62PURZ', stock:'EN STOCK', note:'Facturado como partida propia · 12 TB brutos'},
 {id:'EQ-05', cat:'A', code:'MON-01', desc:'Monitor LED 32" 4K UHD (Samsung S32A600 o equivalente en venta)', qty:2, unit:'pza', cost:229.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=Samsung+S32A600+32+4K', stock:'EN STOCK', note:'Verificado en venta · HDMI 2.0'},
 {id:'EQ-06', cat:'B', code:'SW-01', desc:'Switch PoE 8 puertos Gigabit (TP-Link TL-SG1008P, ~64 W PoE+)', qty:1, unit:'pza', cost:59.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=TL-SG1008P', stock:'EN STOCK', note:'16 puertos NVR + 8 switch = 24 ≥ 21 cámaras'},
 {id:'EQ-07', cat:'B', code:'GAB-01', desc:'Gabinete rack mural 9U con puerta perforada y ventilación', qty:1, unit:'pza', cost:159.00, grade:'B', source:'Distribuidor reconocido', url:'https://www.amazon.com/s?k=wall+mount+rack+9U', stock:'EN STOCK', note:'Aloja NVR, switch, PDU y patch panel'},
 {id:'EQ-08', cat:'B', code:'PP-01', desc:'Patch panel Cat6 24 puertos cargado (110)', qty:1, unit:'pza', cost:42.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=cat6+patch+panel+24+port', stock:'EN STOCK', note:'24 puertos ≥ 21 corridas'},
 {id:'EQ-09', cat:'C', code:'UPS-01', desc:'UPS línea interactiva 1500 VA / 900 W con AVR (CyberPower CP1500AVRLCD3 o equivalente)', qty:1, unit:'pza', cost:199.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=CP1500AVRLCD3', stock:'EN STOCK', note:'Autonomía estimada NVR + switch ≈ 30–45 min'},
 {id:'EQ-10', cat:'B', code:'UTP-01', desc:'Cable Cat6 UTP 100% cobre AWG23 CMR, caja 305 m', qty:6, unit:'caja', cost:109.99, grade:'A', source:'Amazon / Monoprice', url:'https://www.amazon.com/s?k=cat6+utp+305m+box', stock:'EN STOCK', note:'≈75 m por corrida × 21 puntos ≈ 6 cajas (regla aprobada)'},
 {id:'EQ-11', cat:'D', code:'RJ45-01', desc:'Conector RJ45 Cat6 (paquete 100 pz)', qty:2, unit:'pza', cost:14.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=rj45+cat6+connectors+100+pack', stock:'EN STOCK', note:'Incluye 20% de repuesto'},
 {id:'EQ-12', cat:'D', code:'EMT-01', desc:'Tubería EMT 3/4" × 10 ft', qty:20, unit:'tubo', cost:8.98, grade:'A', source:'Home Depot', url:'https://www.homedepot.com/s/EMT%203%2F4%22', stock:'EN STOCK', note:'Ruta principal + derivados'},
 {id:'EQ-13', cat:'D', code:'EMT-ACC', desc:'Accesorios de conduit: codos, conectores, uniones, abrazaderas (lote)', qty:1, unit:'lote', cost:85.00, grade:'A', source:'Home Depot', url:'https://www.homedepot.com/s/EMT+fittings', stock:'EN STOCK', note:''},
 {id:'EQ-14', cat:'D', code:'CAJ-01', desc:'Caja de conexión 4" con placa y prensaestopas', qty:25, unit:'pza', cost:3.48, grade:'A', source:'Home Depot', url:'https://www.homedepot.com/s/4+inch+junction+box', stock:'EN STOCK', note:'Una por cámara + repuesto'},
 {id:'EQ-15', cat:'C', code:'PDU-01', desc:'PDU rack 8 contactos con interruptor', qty:1, unit:'pza', cost:34.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=rack+mount+pdu+8+outlet', stock:'EN STOCK', note:''},
 {id:'EQ-16', cat:'C', code:'SUP-01', desc:'Supresor de picos para gabinete', qty:1, unit:'pza', cost:29.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=surge+protector+outlet', stock:'EN STOCK', note:''},
 {id:'EQ-17', cat:'C', code:'MCB-01', desc:'Interruptor termomagnético MCB 6A 1P DIN (ABB S201-C6 o equivalente certificado)', qty:2, unit:'pza', cost:16.50, grade:'A', source:'Amazon / Home Depot', url:'https://www.amazon.com/s?k=ABB+S201-C6', stock:'EN STOCK', note:'Precio real asignado — nunca $0.00'},
 {id:'EQ-18', cat:'C', code:'GND-01', desc:'Varilla de tierra 5/8" × 8 ft copperclad', qty:1, unit:'pza', cost:24.98, grade:'A', source:'Home Depot', url:'https://www.homedepot.com/s/ground+rod+5%2F8', stock:'EN STOCK', note:''},
 {id:'EQ-19', cat:'C', code:'GND-02', desc:'Cable Cu desnudo #6 AWG, rollo 50 ft', qty:1, unit:'rollo', cost:44.98, grade:'A', source:'Home Depot', url:'https://www.homedepot.com/s/6+awg+bare+copper+wire', stock:'EN STOCK', note:''},
 {id:'EQ-20', cat:'C', code:'GND-03', desc:'Conector de varilla + kit de aterramiento', qty:1, unit:'kit', cost:12.98, grade:'A', source:'Home Depot', url:'https://www.homedepot.com/s/ground+rod+clamp', stock:'EN STOCK', note:''},
 {id:'EQ-21', cat:'H', code:'ACC-01', desc:'Ferrules, cintas velcro, etiquetas y consumibles de instalación (lote)', qty:1, unit:'lote', cost:34.99, grade:'A', source:'Amazon', url:'https://www.amazon.com/s?k=ferrule+kit+wire+labels', stock:'EN STOCK', note:''}
];

/* Software CCTV — puede tener valor económico o ser gratuito justificado */
const SOFTWARE = [
 {id:'SW-01', nombre:'Hikvision iVMS-4200 (estación de gestión)', tipo:'Gratuita', cant:1, unidad:'lic', pu:0.00, fuente:'Hikvision (fabricante)', url:'https://www.hikvision.com/en/support/download/clientsoftware/', obs:'JUSTIFICACIÓN: Software oficial gratuito del fabricante (Opción A)'}
];

const MO_CATS = ['Ingeniería','Instalación','Redes','Configuración','Commissioning','Pruebas','Capacitación'];

/* Mano de obra — Cantidad × Precio Unitario = Subtotal */
const LABOR = [
 {n:1,  cat:'Ingeniería',   op:'Levantamiento técnico de campo y plano de ubicación de puntos', unidad:'h', cant:3,   resp:'I', pu:65},
 {n:2,  cat:'Instalación',  op:'Instalación y nivelación de gabinete rack mural 9U', unidad:'h', cant:4,   resp:'T', pu:28},
 {n:3,  cat:'Instalación',  op:'Tendido de tubería EMT 3/4" (ruta principal 75 m + derivados)', unidad:'h', cant:12,  resp:'T', pu:28},
 {n:4,  cat:'Redes',        op:'Tendido de cableado horizontal Cat6 (21 corridas)', unidad:'h', cant:16,  resp:'T', pu:28},
 {n:5,  cat:'Instalación',  op:'Terminación y montaje de cámara domo (1)', unidad:'h', cant:1.5, resp:'T', pu:28},
 {n:6,  cat:'Instalación',  op:'Terminación y montaje de cámaras bullet (20)', unidad:'h', cant:14,  resp:'T', pu:28},
 {n:7,  cat:'Redes',        op:'Terminación y parcheo en patch panel (24 puertos)', unidad:'h', cant:5,   resp:'T', pu:28},
 {n:8,  cat:'Redes',        op:'Prueba y rotulado de los 21 enlaces', unidad:'h', cant:2,   resp:'T', pu:28},
 {n:9,  cat:'Instalación',  op:'Montaje de NVR en rack', unidad:'h', cant:1,   resp:'T', pu:28},
 {n:10, cat:'Instalación',  op:'Instalación de 2 HDD en NVR', unidad:'h', cant:0.5, resp:'T', pu:28},
 {n:11, cat:'Redes',        op:'Instalación de switch PoE y PDU', unidad:'h', cant:1,   resp:'T', pu:28},
 {n:12, cat:'Instalación',  op:'Instalación de supresor de picos', unidad:'h', cant:0.5, resp:'T', pu:28},
 {n:13, cat:'Instalación',  op:'Instalación de interruptores MCB 6A', unidad:'h', cant:1.5, resp:'S', pu:45},
 {n:14, cat:'Instalación',  op:'Sistema de aterramiento (varilla, conductor #6, conexiones)', unidad:'h', cant:3,   resp:'S', pu:45},
 {n:15, cat:'Instalación',  op:'Montaje de monitores 32" (2) y conexión HDMI', unidad:'h', cant:2,   resp:'T', pu:28},
 {n:16, cat:'Configuración',op:'Configuración de red: IPs estáticas, VLAN, switch', unidad:'h', cant:2,   resp:'I', pu:65},
 {n:17, cat:'Configuración',op:'Configuración de NVR: detección de 21 cámaras, títulos', unidad:'h', cant:2,   resp:'I', pu:65},
 {n:18, cat:'Configuración',op:'Programación de grabación continua + eventos y retención', unidad:'h', cant:1.5, resp:'I', pu:65},
 {n:19, cat:'Configuración',op:'Ajuste de encuadre y campo de visión (21 cámaras)', unidad:'h', cant:3,   resp:'S', pu:45},
 {n:20, cat:'Configuración',op:'Configuración de analíticos y alertas', unidad:'h', cant:1.5, resp:'I', pu:65},
 {n:21, cat:'Configuración',op:'Instalación y configuración de iVMS-4200 en estación', unidad:'h', cant:1,   resp:'I', pu:65},
 {n:22, cat:'Pruebas',      op:'Pruebas de campo por punto (21): video, PoE, IR', unidad:'h', cant:4,   resp:'T', pu:28},
 {n:23, cat:'Pruebas',      op:'Certificación de enlaces Cat6 y correcciones', unidad:'h', cant:4,   resp:'T', pu:28},
 {n:24, cat:'Commissioning',op:'Prueba de persistencia de grabación 24 h', unidad:'h', cant:2,   resp:'S', pu:45},
 {n:25, cat:'Pruebas',      op:'Prueba de UPS y autonomía', unidad:'h', cant:1,   resp:'T', pu:28},
 {n:26, cat:'Ingeniería',   op:'Rotulado final y documentación as-built', unidad:'h', cant:3,   resp:'T', pu:28},
 {n:27, cat:'Capacitación', op:'Capacitación al personal (sesión 2 h)', unidad:'h', cant:2,   resp:'S', pu:45},
 {n:28, cat:'Commissioning',op:'QA final / punch list', unidad:'h', cant:2,   resp:'S', pu:45},
 {n:29, cat:'Commissioning',op:'Entrega, acta de puesta en servicio y cierre', unidad:'h', cant:1,   resp:'I', pu:65}
];

/* Transporte — opcional (interruptor OFF por defecto) */
const TRANSPORT = {
  enabled:false, mode:'items',
  fijo:0, pct:0, viajes:0, costoViaje:0, km:0, costoKm:0, manual:0,
  items:[]
};

/* Sustituciones y equivalencias documentadas */
const SUSTITUCIONES = [
 {id:'SUS-01', original:'NVR Hikvision DS-7932N-K4 (32 ch)', sustituto:'NVR Hikvision DS-7732NI-K4/16P (32 ch, 16 PoE)',
  motivo:'El modelo original no garantiza 21 cámaras IP como plataforma pura IP; el sustituto integra 16 puertos PoE y 2 bahías SATA',
  impacto:'+ USD 479.00 (partida EQ-03)', estado:'APROBADO'}
];

const AUDIT = [
 {n:1,  area:'NVR',            hallazgo:'El NVR original DS-7932N-K4 no garantiza 21 cámaras IP como plataforma pura IP', estado:'CORREGIDO', accion:'Sustituido por DS-7732NI-K4/16P (32 ch IP, 16 PoE). Verificar disponibilidad/precio/garantía al comprar'},
 {n:2,  area:'Almacenamiento', hallazgo:'Los 2×6 TB aparecían como "material recomendado" sin costo', estado:'CORREGIDO', accion:'HDD facturado como partida EQ-04 (USD 249.98)'},
 {n:3,  area:'Eléctrico',      hallazgo:'Interruptor 6A sin precio ($0.00)', estado:'CORREGIDO', accion:'Asignado MCB 6A DIN fuente A (EQ-17, USD 16.50 c/u)'},
 {n:4,  area:'Equipos',        hallazgo:'Monitor 32" 4K: verificar venta activa', estado:'OK', accion:'Samsung S32A600 (o equivalente) disponible en Amazon'},
 {n:5,  area:'Trazabilidad',   hallazgo:'Verificación de URLs de fuente', estado:'PENDIENTE', accion:'URLs de búsqueda funcionales; validar listado exacto antes de emitir OC'},
 {n:6,  area:'Disponibilidad', hallazgo:'Confirmar stock en fuente A/B', estado:'PENDIENTE', accion:'Estado inicial EN STOCK; confirmar al momento de compra'},
 {n:7,  area:'Proveedores',    hallazgo:'Fuente dudosa (eBee.com) detectada como principal', estado:'CORREGIDO', accion:'Excluida; toda partida tiene fuente A/B (Amazon / Home Depot / distribuidor)'},
 {n:8,  area:'Software',       hallazgo:'Costo de software sin justificar', estado:'OK', accion:'Opción A: iVMS-4200 gratuito del fabricante, justificación documentada (Software CCTV · SW-01)'},
 {n:9,  area:'PoE · Puertos',  hallazgo:'21 cámaras vs puertos PoE disponibles', estado:'OK', accion:'16 (NVR) + 8 (switch) = 24 puertos ≥ 21'},
 {n:10, area:'PoE · Potencia', hallazgo:'Presupuesto PoE vs carga real', estado:'OK', accion:'Carga ≈ 136.5 W vs 234 W disponibles (margen > 20%)'},
 {n:11, area:'Ancho de banda', hallazgo:'Tráfico de cámaras vs capacidad entrante del NVR', estado:'OK', accion:'21 × 4 Mbps = 84 Mbps ≤ 256 Mbps'},
 {n:12, area:'Almacenamiento', hallazgo:'Retención real con 12 TB @ 4 Mbps/cámara', estado:'ADVERTENCIA', accion:'≈ 13 días. Si el cliente exige 30 días: ampliar a 2×10 TB o 4×6 TB'},
 {n:13, area:'Alcance',        hallazgo:'1 domo + 20 bullets = 21 puntos', estado:'OK', accion:'Coherente con plano / levantamiento'},
 {n:14, area:'Impuestos',      hallazgo:'Impuesto configurable (11% por defecto)', estado:'OK', accion:'Aplicado sobre subtotal tras utilidad, según fórmula oficial'},
 {n:15, area:'Utilidad',       hallazgo:'Markup 30% sobre costo directo', estado:'OK', accion:'CD → U → Subtotal de Venta → Impuesto → Total de Oferta'},
 {n:16, area:'Mano de obra',   hallazgo:'29 operaciones en 3 niveles (T/S/I)', estado:'OK', accion:'Cantidades y precios unitarios editables; totales en tiempo real'},
 {n:17, area:'Totales',        hallazgo:'Coherencia aritmética del presupuesto', estado:'OK', accion:'Validación automática #14'},
 {n:18, area:'Precios',        hallazgo:'Cobertura de precios A/B', estado:'PENDIENTE', accion:'Ver indicador de cobertura en Dashboard (meta: 100%)'},
 {n:19, area:'Clasificación',  hallazgo:'Clasificación económica A–J por partida', estado:'OK', accion:'Asignada y visible en Dashboard'},
 {n:20, area:'Transporte',     hallazgo:'Módulo de transporte', estado:'OK', accion:'Desactivado por defecto; lista de gastos + 5 modos configurables'}
];

const VALIDATIONS = [
 {n:1,  desc:'Cobertura de precios A/B = 100%'},
 {n:2,  desc:'Sin precios $0.00 sin justificación documentada'},
 {n:3,  desc:'Sin partidas con fuente C/D sin aprobar'},
 {n:4,  desc:'NVR compatible: canales ≥ cámaras instaladas'},
 {n:5,  desc:'Puertos y presupuesto PoE con margen ≥ 20%'},
 {n:6,  desc:'Ancho de banda entrante dentro de la capacidad del NVR'},
 {n:7,  desc:'Retención de grabación ≥ objetivo configurado'},
 {n:8,  desc:'HDD de vigilancia incluido como partida facturable'},
 {n:9,  desc:'100% de partidas con URL de fuente'},
 {n:10, desc:'Disponibilidad confirmada (EN STOCK / GRATUITO)'},
 {n:11, desc:'Sin proveedores dudosos'},
 {n:12, desc:'Software con precio o justificación documentada'},
 {n:13, desc:'Mano de obra completa (≥ 29 operaciones) con cantidades y precios'},
 {n:14, desc:'Aritmética de totales verificada (fórmula oficial)'},
 {n:15, desc:'Impuesto configurado correctamente'},
 {n:16, desc:'Datos del proyecto completos (nombre, dirección, fecha)'}
];
