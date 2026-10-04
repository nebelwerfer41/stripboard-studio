#!/usr/bin/env python3
"""Local, dependency-free viewer for Movie Magic Scheduling 6 files."""
from __future__ import annotations

import json
import tempfile
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree as ET

from msd_parser import MsdError, normalize

ROOT = Path(__file__).resolve().parent
SAMPLES = {
    "zustissia": ROOT / "samples" / "ZUSTISSIA - v12D - 5.02_Backup_3.msd",
    "passenger": ROOT / "samples" / "The Passenger_27.10.msd",
}
MAX_UPLOAD = 20 * 1024 * 1024


def shapes(section):
    if section is None:
        return []
    result = []
    for node in section.findall("./Layout/Shapes/*"):
        result.append({
            "tag": node.tag,
            "a": dict(node.attrib),
            "font": dict(node.find("Font").attrib) if node.find("Font") is not None else {},
            "categories": [x.get("CategoryName") for x in node.findall("CategoryRef")],
        })
    return result


def parse_layouts(xml, kind):
    if not xml:
        return []
    root = ET.fromstring(xml)
    if kind == "strip":
        nodes = root.findall("./StripBoardLayouts/StripBoardLayout")
        return [{
            "name": n.get("Name"), "orientation": n.get("StripOrientation", "HORIZONTAL"),
            "length": n.get("StripLength"), "width": n.get("StripWidth"),
            "attributes": dict(n.attrib),
            "pageFormat": dict(n.find("PageFormat").attrib) if n.find("PageFormat") is not None else {},
            "paper": dict(n.find("./PageFormat/Paper").attrib)
                     if n.find("./PageFormat/Paper") is not None else {},
            "fields": shapes(n.find("BDSStripLayout")),
            "header": shapes(n.find("StripBoardHeaderLayout")),
            "headerLayout": dict(n.find("StripBoardHeaderLayout").attrib)
                            if n.find("StripBoardHeaderLayout") is not None else {},
            "dayBreakText": (n.find("DayBreakStripLayout").get("DayBreakText", "")
                             if n.find("DayBreakStripLayout") is not None else ""),
            "dayBreakLayout": dict(n.find("DayBreakStripLayout").attrib)
                              if n.find("DayBreakStripLayout") is not None else {},
            "stripLayout": dict(n.find("BDSStripLayout").attrib)
                           if n.find("BDSStripLayout") is not None else {},
            "textStyles": {x.tag: dict(x.attrib) for x in n.findall("./TextStyles/*")},
            "bannerStyle": dict(n.find("./TextStyles/BANNER").attrib)
                           if n.find("./TextStyles/BANNER") is not None else {},
            "dayBreakStyle": dict(n.find("./TextStyles/DAY_BREAK").attrib)
                             if n.find("./TextStyles/DAY_BREAK") is not None else {},
        } for n in nodes]
    nodes = root.findall("./ReportLayouts/ReportLayout")
    return [{
        "name": n.get("Name"), "sourceType": n.get("ReportSourceType"),
        "recordType": n.get("ReportRecordType"),
        "settings": dict(n.find("ReportSettings").attrib) if n.find("ReportSettings") is not None else {},
        "dayBreakText": dict(n.find("./ReportSettings/DayBreakText").attrib)
                        if n.find("./ReportSettings/DayBreakText") is not None else {},
        "paper": dict(n.find("./PageFormat/Paper").attrib) if n.find("./PageFormat/Paper") is not None else {},
        "header": shapes(n.find("PageHeaderLayout")),
        "record": shapes(n.find("ReportRecordLayout")),
        "footer": shapes(n.find("PageFooterLayout")),
        "headerHeight": n.find("PageHeaderLayout").get("Height") if n.find("PageHeaderLayout") is not None else "0",
        "recordHeight": n.find("ReportRecordLayout").get("Height") if n.find("ReportRecordLayout") is not None else "0",
        "footerHeight": n.find("PageFooterLayout").get("Height") if n.find("PageFooterLayout") is not None else "0",
        "criteria": [dict(x.attrib) for x in n.findall("./SelectCriteriaList/SelectCriteria")],
    } for n in nodes]


def rgb_color(value):
    try:
        parts = [int(x) for x in value.split(",")]
    except (AttributeError, ValueError):
        return None
    if len(parts) != 3 or any(x < 0 or x > 255 for x in parts):
        return None
    return "#" + "".join(f"{x:02x}" for x in parts)


def parse_colors(xml):
    if not xml:
        return {"columns": [], "rows": [], "cells": {}, "preferences": {}}
    root = ET.fromstring(xml)
    columns = {int(x.get("ColumnNumber")): x.get("Name", "")
               for x in root.findall("./ColorGrid/ColumnLabelList/ColumnLabel")}
    rows = {int(x.get("RowNumber")): x.get("Name", "")
            for x in root.findall("./ColorGrid/RowLabelList/RowLabel")}
    cells = {f"{x.get('RowNumber')}:{x.get('ColumnNumber')}":
             {"fg": rgb_color(x.get("Fg")), "bg": rgb_color(x.get("Bg"))}
             for x in root.findall("./ColorGrid/ColorGridCells/ColorGridCell")}
    prefs = {x.get("Name"): {"fg": rgb_color(x.get("Fg")), "bg": rgb_color(x.get("Bg"))}
             for x in root.findall("./StripColorPreferences/StripColorPreference")}
    return {"columns": columns, "rows": rows, "cells": cells, "preferences": prefs}


def compact_strip(item):
    result = {k: item.get(k) for k in ("kind", "bdsId", "text")}
    if item["kind"] == "banner":
        attrs = item["source"]["attributes"]
        result["attributes"] = dict(attrs)
        result["style"] = {"fontColor": rgb_color(attrs.get("FontColor")),
                           "fontSize": attrs.get("FontSize"),
                           "fontStyle": attrs.get("FontStyle"),
                           "fontName": attrs.get("FontName"),
                           "customized": attrs.get("IsCustomized") == "1"}
    return result


def compact(project):
    xml = project["sourceXmlSections"]
    props = {}
    production = project.get("productionInfo") or {}
    for child in production.get("children", []):
        for prop in child.get("children", []):
            if prop.get("tag") == "Property":
                a = prop["attributes"]
                props[a.get("Name")] = a.get("Value", prop.get("text") or "")
    scene_keys = ("bdsId", "scene", "sheetNumber", "synopsis", "sequence", "ie", "dn", "set", "location",
                  "scriptDay", "scriptPageNumbers", "unit", "estimateTimeA", "estimateTimeB", "comments",
                  "pagesEighths", "requirements")
    return {
        "fileName": project["source"]["fileName"],
        "title": props.get("PictureTitle") or Path(project["source"]["fileName"]).stem,
        "production": props,
        "counts": project["counts"],
        "activeBoard": project["activeStripBoard"],
        "scenes": [{k: s.get(k) for k in scene_keys} for s in project["scenes"]],
        "elements": [{"category": e["category"], "name": e["name"], "boardId": e["boardId"],
                      "properties": {x["attributes"].get("Name"): x["attributes"].get("Value", x.get("text") or "")
                                     for x in e["properties"]}}
                     for e in project["elements"]],
        "boards": [{"name": b["name"], "description": b["description"], "calendarName": b["calendarName"],
                    "attributes": b["attributes"],
                    "scheduledGroups": [{"kind": g["kind"], "ordinal": g.get("ordinal"), "date": g["date"],
                                         "strips": [compact_strip(x) for x in g["strips"]]}
                                        for g in b["scheduledGroups"]],
                    "unscheduledGroups": [{"kind": g["kind"], "strips": [compact_strip(x) for x in g["strips"]]}
                                          for g in b["unscheduledGroups"]],
                    "dateAudit": b["dateAudit"]} for b in project["stripboards"]],
        "stripLayouts": parse_layouts(xml.get("StripBoardLayoutMgr"), "strip"),
        "reportLayouts": parse_layouts(xml.get("ReportLayoutMgr"), "report"),
        "colors": parse_colors(xml.get("ColorSettings")),
        "issues": project["validation"]["issueCounts"],
    }


class Handler(BaseHTTPRequestHandler):
    def send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/project":
            key = parse_qs(url.query).get("sample", [""])[0]
            if key not in SAMPLES:
                return self.send_json({"error": "Progetto non trovato"}, 404)
            try:
                return self.send_json(compact(normalize(SAMPLES[key])))
            except (OSError, MsdError, ValueError, ET.ParseError) as exc:
                return self.send_json({"error": str(exc)}, 400)
        path = "index.html" if url.path == "/" else url.path.lstrip("/")
        if path not in ("index.html", "assets/app.js", "assets/style.css"):
            self.send_error(404)
            return
        data = (ROOT / path).read_bytes()
        mime = "text/html" if path.endswith(".html") else "text/javascript" if path.endswith(".js") else "text/css"
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != "/api/import":
            return self.send_json({"error": "Percorso non trovato"}, 404)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > MAX_UPLOAD:
                return self.send_json({"error": "Il file deve essere inferiore a 20 MB"}, 413)
            data = self.rfile.read(size)
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "imported.msd"
                path.write_bytes(data)
                result = compact(normalize(path))
                result["fileName"] = self.headers.get("X-File-Name", "imported.msd")
                return self.send_json(result)
        except (OSError, MsdError, ValueError, ET.ParseError) as exc:
            return self.send_json({"error": str(exc)}, 400)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Stripboard Studio locale")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as exc:
        if exc.errno != 48:  # macOS: address already in use
            raise
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    address = f"http://127.0.0.1:{server.server_port}"
    print(f"Stripboard Studio: {address}", flush=True)
    if not args.no_browser:
        webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
