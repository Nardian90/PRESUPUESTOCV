#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MISIÓN III-B · Fase 5 — Capa de acceso local para consultar el catálogo
PRECODI importado desde la propia aplicación PRECOST v9.17.

DECISIÓN DE ARQUITECTURA (justificada):
  PRECOST es un HTML autónomo que el usuario abre localmente (incluso con
  file://). Un navegador NO puede abrir SQLite directamente ni hacer fetch de
  file:// con garantías. Las opciones eran:
    (a) sql.js (SQLite WASM) + servir el .db por HTTP: requiere dependencia
        externa (~1.5 MB de WASM) y sigue necesitando un servidor HTTP para
        el fetch inicial.
    (b) CAPA DE ACCESO LOCAL (elegida): servidor HTTP mínimo de la librería
        estándar (cero dependencias, 100% offline) que:
          - sirve el HTML ORIGINAL desde disco SIN modificarlo, inyectando
            al vuelo una única etiqueta <script> aditiva antes de </body>
            (el archivo en disco permanece byte-idéntico, verificable por
            SHA-256);
          - expone /api/* en modo SOLO LECTURA sobre bd/precodi.db;
          - escucha ÚNICAMENTE en 127.0.0.1 (no es un servicio público).
  La opción (b) es reversible (apagar el proceso y no queda nada), no toca
  el catálogo embebido de PRECOST ni su contrato PRECOST-AI-JSON, y no
  depende de terceros. La vía sql.js/OPFS queda documentada como evolución
  futura si se quiere eliminar el proceso local.

Uso:  python3 scripts/servidor_precodi.py [--puerto 8765] [--bd bd/precodi.db]
      → abrir http://127.0.0.1:8765/
"""
import argparse
import json
import os
import re
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(REPO, "app", "PRECOST-v9.17.html")
OVERLAY = os.path.join(REPO, "app", "overlay", "precodi.js")
BD_DEFECTO = os.path.join(REPO, "bd", "precodi.db")
SHA_HTML = "50d3cf28e405201f36c50c3dd5385d7e28fbab3e7e5eee22c74ca0bcfd5cbaa2"

INYECCION = b'\n<script src="/overlay/precodi.js" defer></script>\n'


def conectar_ro(ruta_bd):
    """Conexión SOLO LECTURA (mode=ro): el importador es el único que escribe."""
    con = sqlite3.connect(f"file:{ruta_bd}?mode=ro", uri=True, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA query_only = ON")
    return con


class Manejador(BaseHTTPRequestHandler):
    bd = None  # se inyecta al arrancar

    # ------------------------------------------------------------------ util
    def _json(self, obj, codigo=200):
        cuerpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def log_message(self, fmt, *args):  # log compacto
        print(f"  {self.address_string()} {fmt % args}")

    # ------------------------------------------------------------------ GET
    def do_GET(self):
        try:
            u = urlparse(self.path)
            if u.path in ("/", "/index.html"):
                return self._servir_html()
            if u.path == "/overlay/precodi.js":
                return self._servir_archivo(OVERLAY, "application/javascript; charset=utf-8")
            if u.path.startswith("/api/"):
                return self._api(u.path, parse_qs(u.query))
            self._json({"error": "no encontrado", "ruta": u.path}, 404)
        except Exception as e:  # noqa: BLE001
            self._json({"error": f"{type(e).__name__}: {e}"}, 500)

    def _servir_html(self):
        """Sirve el HTML original INYECTANDO solo la etiqueta del overlay.

        El archivo en disco no se toca: la inyección ocurre en la copia
        servida, inmediatamente antes del </body> real (última aparición).
        """
        with open(HTML, "rb") as f:
            contenido = f.read()
        i = contenido.rfind(b"</body>")
        if i >= 0:
            contenido = contenido[:i] + INYECCION + contenido[i:]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(contenido)))
        self.end_headers()
        self.wfile.write(contenido)

    def _servir_archivo(self, ruta, tipo):
        with open(ruta, "rb") as f:
            cuerpo = f.read()
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    # ------------------------------------------------------------------ API
    def _api(self, ruta, q):
        con = conectar_ro(self.bd)
        try:
            if ruta == "/api/versiones":
                return self._api_versiones(con)
            if ruta == "/api/partidas":
                return self._api_partidas(con, q)
            m = re.match(r"^/api/partida/([0-9A-Za-z%_\-]+)$", ruta)
            if m:
                return self._api_partida(con, m.group(1), q)
            if ruta == "/api/stats":
                return self._api_stats(con)
            self._json({"error": "endpoint desconocido"}, 404)
        finally:
            con.close()

    def _api_versiones(self, con):
        filas = con.execute("""
            SELECT vc.id, c.codigo AS catalogo, vc.version, vc.estado, vc.fecha_importacion,
                   vc.fuente_archivo, vc.fuente_sha256, vc.fecha_publicacion, vc.fuente_detalle
            FROM versiones_catalogo vc JOIN catalogos c ON c.id = vc.catalogo_id
            ORDER BY vc.id""").fetchall()
        out = []
        for f in filas:
            v = dict(f)
            v["partidas"] = con.execute(
                "SELECT COUNT(*) FROM partidas WHERE version_id=?", (f["id"],)).fetchone()[0]
            v["recursos"] = con.execute(
                "SELECT COUNT(*) FROM recursos WHERE version_id=?", (f["id"],)).fetchone()[0]
            v["normas"] = con.execute(
                "SELECT COUNT(*) FROM normas_partida WHERE version_id=?", (f["id"],)).fetchone()[0]
            v["descomponibles"] = con.execute(
                """SELECT COUNT(DISTINCT partida_id) FROM normas_partida WHERE version_id=?""",
                (f["id"],)).fetchone()[0]
            out.append(v)
        self._json({"versiones": out, "html_original_intacto": self._html_intacto()})

    @staticmethod
    def _html_intacto():
        import hashlib
        h = hashlib.sha256()
        with open(HTML, "rb") as f:
            for b in iter(lambda: f.read(1 << 20), b""):
                h.update(b)
        return h.hexdigest() == SHA_HTML

    def _api_partidas(self, con, q):
        texto = (q.get("q", [""])[0] or "").strip()
        version_id = q.get("version_id", [None])[0]
        limite = min(int(q.get("limit", [30])[0]), 200)
        sql = """SELECT p.codigo, p.descripcion, p.unidad, p.factor_unidad, p.capitulo,
                        p.costo_mat_mn, p.costo_mo_mn, p.costo_eq_mn, p.costo_total_mn,
                        p.costo_mat_mlc, vc.version, c.codigo AS catalogo
                 FROM partidas p JOIN versiones_catalogo vc ON vc.id = p.version_id
                 JOIN catalogos c ON c.id = vc.catalogo_id"""
        condiciones, params = [], []
        if version_id:
            condiciones.append("p.version_id = ?")
            params.append(version_id)
        if texto:
            condiciones.append("(p.codigo LIKE ? OR p.descripcion LIKE ? COLLATE NOCASE)")
            params += [f"%{texto}%", f"%{texto}%"]
        if condiciones:
            sql += " WHERE " + " AND ".join(condiciones)
        sql += " ORDER BY p.codigo LIMIT ?"
        params.append(limite)
        filas = [dict(r) for r in con.execute(sql, params).fetchall()]
        self._json({"q": texto, "resultados": filas, "n": len(filas)})

    def _api_partida(self, con, codigo, q):
        version_id = q.get("version_id", [None])[0]
        fila = con.execute("""
            SELECT p.*, vc.version, vc.fecha_importacion, vc.fuente_archivo, vc.fuente_sha256,
                   c.codigo AS catalogo
            FROM partidas p JOIN versiones_catalogo vc ON vc.id = p.version_id
            JOIN catalogos c ON c.id = vc.catalogo_id
            WHERE p.codigo = ?""" + (" AND p.version_id=?" if version_id else "") + """
            ORDER BY vc.fecha_importacion DESC LIMIT 1""",
            (codigo, version_id) if version_id else (codigo,)).fetchone()
        if not fila:
            return self._json({"error": "partida no encontrada", "codigo": codigo}, 404)
        p = dict(fila)

        # descomposición: normas + recurso + componentes de compuestos
        normas = []
        for n in con.execute("""
                SELECT np.tipo_recurso_id, tr.codigo AS tipo, np.codigo_recurso, np.coeficiente,
                       np.cod_norma, np.um_norma, r.descripcion AS recurso_desc, r.unidad AS recurso_um,
                       r.precio_mn, r.precio_mlc
                FROM normas_partida np
                JOIN tipos_recurso tr ON tr.id = np.tipo_recurso_id
                LEFT JOIN recursos r ON r.version_id = np.version_id
                     AND r.tipo_id = np.tipo_recurso_id AND r.codigo = np.codigo_recurso
                WHERE np.partida_id = ? ORDER BY tr.id, np.codigo_recurso""",
                (p["id"],)).fetchall():
            n = dict(n)
            componentes = []
            if n["tipo"] in ("juego", "semielaborado"):
                for c in con.execute("""
                        SELECT cr.codigo_componente, tr2.codigo AS tipo_componente, cr.coeficiente,
                               r2.descripcion, r2.unidad, r2.precio_mn
                        FROM componentes_recurso cr
                        JOIN tipos_recurso tr2 ON tr2.id = cr.tipo_componente_id
                        LEFT JOIN recursos r2 ON r2.version_id = cr.version_id
                             AND r2.tipo_id = cr.tipo_componente_id AND r2.codigo = cr.codigo_componente
                        WHERE cr.recurso_id = (SELECT id FROM recursos WHERE version_id=? AND codigo=?
                                               AND tipo_id=(SELECT id FROM tipos_recurso WHERE codigo=?))
                        ORDER BY tr2.id, cr.codigo_componente""",
                        (p["version_id"], n["codigo_recurso"], n["tipo"])).fetchall():
                    c = dict(c)
                    c["subtotal"] = (c["coeficiente"] or 0) * (c["precio_mn"] or 0)
                    componentes.append(c)
            n["subtotal"] = (n["coeficiente"] or 0) * (n["precio_mn"] or 0)
            n["componentes"] = componentes
            normas.append(n)

        # subtotales por tipo (Decimal para la verificación, float para la respuesta)
        from decimal import Decimal
        sumas, n_terms, suma_abs = {}, 0, 0.0
        for n in normas:
            d = (Decimal(str(n["coeficiente"] or 0)) * Decimal(str(n["precio_mn"] or 0)))
            sumas[n["tipo"]] = sumas.get(n["tipo"], Decimal(0)) + d
            n_terms += 1
            suma_abs += abs(float(d))
        import math
        tol = max(0.0001 * max(1, n_terms), suma_abs * 6e-8)

        def cmp(almacenado, recalculado):
            if almacenado is None:
                return None
            delta = float(recalculado) - almacenado
            return {"almacenado": almacenado, "recalculado": float(recalculado),
                    "delta": delta, "coincide": abs(delta) <= tol, "tolerancia": tol}

        verificacion = {
            "cmmn": cmp(p["costo_mat_mn"], sumas.get("material", 0) + sumas.get("juego", 0)
                        + sumas.get("semielaborado", 0)),
            "chmn": cmp(p["costo_mo_mn"], sumas.get("mano_obra", 0)),
            "cemn": cmp(p["costo_eq_mn"], sumas.get("equipo", 0)),
            "regla": "|Δ| ≤ max(0.0001·N, Σ|coef·precio|·6e-8) — tolerancia por número de "
                     "términos y magnitud, documentada en docs/FASE_III_INTEGRACION.md",
        }
        # el mismo código en otras versiones (comparación de precios)
        otras = [dict(r) for r in con.execute("""
                SELECT vc.version, c.codigo AS catalogo, p.costo_total_mn, p.unidad
                FROM partidas p JOIN versiones_catalogo vc ON vc.id=p.version_id
                JOIN catalogos c ON c.id=vc.catalogo_id
                WHERE p.codigo=? AND p.version_id != ? ORDER BY vc.id""", (codigo, p["version_id"]))]

        self._json({"partida": p, "normas": normas,
                    "subtotales": {k: float(v) for k, v in sumas.items()},
                    "verificacion": verificacion, "otras_versiones": otras,
                    "html_original_intacto": self._html_intacto()})

    def _api_stats(self, con):
        out = {}
        for f in con.execute("""SELECT vc.id, c.codigo||'/'||vc.version AS clave FROM versiones_catalogo vc
                                JOIN catalogos c ON c.id=vc.catalogo_id ORDER BY vc.id"""):
            conteo = {}
            for tabla in ("partidas", "recursos", "normas_partida", "componentes_recurso"):
                conteo[tabla] = con.execute(
                    f"SELECT COUNT(*) FROM {tabla} WHERE version_id=?", (f["id"],)).fetchone()[0]
            out[f["clave"]] = conteo
        self._json({"stats": out})


def main():
    ap = argparse.ArgumentParser(description="Capa de acceso local PRECODI para PRECOST (solo lectura)")
    ap.add_argument("--puerto", type=int, default=8765)
    ap.add_argument("--bd", default=BD_DEFECTO)
    args = ap.parse_args()

    if not os.path.exists(args.bd):
        sys.exit(f"No existe {args.bd}: ejecute antes scripts/importar_precodi.py --todas")
    Manejador.bd = args.bd
    srv = ThreadingHTTPServer(("127.0.0.1", args.puerto), Manejador)
    print(f"Capa de acceso local PRECODI (SOLO LECTURA, 127.0.0.1)")
    print(f"  Base:   {args.bd}")
    print(f"  App:    http://127.0.0.1:{args.puerto}/  (PRECOST original + overlay aditivo)")
    print(f"  API:    http://127.0.0.1:{args.puerto}/api/versiones")
    print(f"  HTML original en disco intacto: {Manejador._html_intacto()}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")


if __name__ == "__main__":
    sys.exit(main())
