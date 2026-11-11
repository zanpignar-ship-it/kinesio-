"""Generate independent reference data for the geo tests with pyproj (PROJ).

Usage: python scripts/fixtures/make_fixtures.py   (needs: pip install pyproj pyshp)
Writes tests/fixtures/reference-points.json and the shapefile zips.
"""
import io
import json
import zipfile
from pathlib import Path

import shapefile  # pyshp
from pyproj import CRS
from pyproj.aoi import AreaOfInterest
from pyproj.transformer import TransformerGroup

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / "tests" / "fixtures"
FIX.mkdir(parents=True, exist_ok=True)

POINTS = [
    ("Ljubljana", "EPSG:3794", 14.505751, 46.049865),
    ("Kocevje", "EPSG:3794", 14.862514, 45.642134),
    ("Maribor", "EPSG:3794", 15.645900, 46.554700),
    ("Ljubljana D48", "EPSG:3912", 14.505751, 46.049865),
    ("Zagreb", "EPSG:3765", 15.981900, 45.815000),
    ("Banja Luka", "EPSG:3908", 17.191000, 44.772200),
    ("Banja Luka (MGI)", "EPSG:31276", 17.191000, 44.772200),
    ("Sombor", "EPSG:3908", 19.112000, 45.774000),
    ("Novi Sad", "EPSG:3909", 19.833500, 45.267100),
    ("Novi Sad (MGI)", "EPSG:31277", 19.833500, 45.267100),
    ("Ljubljana UTM", "EPSG:32633", 14.505751, 46.049865),
    ("Beograd UTM", "EPSG:32634", 20.448900, 44.786600),
]


# Deprecated MGI Balkans codes: PROJ has no datum shift for them in BiH/Serbia, so use
# their MGI 1901 successors (same projection, Bessel) to get a real datum shift.
SUCCESSOR = {"EPSG:31276": "EPSG:3908", "EPSG:31277": "EPSG:3909"}


def to_projected(crs: str, lon: float, lat: float) -> tuple[float, float]:
    """Most accurate PROJ transformation for this exact location (area of interest)."""
    aoi = AreaOfInterest(lon - 0.01, lat - 0.01, lon + 0.01, lat + 0.01)
    group = TransformerGroup("EPSG:4326", SUCCESSOR.get(crs, crs), always_xy=True, area_of_interest=aoi)
    t = group.transformers[0]
    x, y = t.transform(lon, lat)
    return round(x, 3), round(y, 3)


refs = []
for name, crs, lon, lat in POINTS:
    x, y = to_projected(crs, lon, lat)
    refs.append({"name": name, "crs": crs, "x": x, "y": y, "lon": lon, "lat": lat})
(FIX / "reference-points.json").write_text(json.dumps(refs, indent=2) + "\n")

# ~1 ha square near Kocevje + a point, as shapefiles (WGS84 with .prj, D96/TM without .prj)
SQUARE = [(14.861234, 45.641234), (14.862514, 45.641234), (14.862514, 45.642134), (14.861234, 45.642134), (14.861234, 45.641234)]


def write_shp_zip(path: Path, coords, prj: str | None) -> None:
    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=shapefile.POLYGON)
    w.field("ime", "C", 40)
    # shapefile outer rings are clockwise
    w.poly([list(reversed(coords))])
    w.record("Parcela 1")
    w.close()
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("parcele.shp", shp.getvalue())
        z.writestr("parcele.shx", shx.getvalue())
        z.writestr("parcele.dbf", dbf.getvalue())
        if prj:
            z.writestr("parcele.prj", prj)


write_shp_zip(FIX / "plots-wgs84.zip", SQUARE, CRS.from_epsg(4326).to_wkt("WKT1_ESRI"))
d96 = [to_projected("EPSG:3794", lon, lat) for lon, lat in SQUARE]
write_shp_zip(FIX / "plots-d96-noprj.zip", d96, None)
write_shp_zip(FIX / "plots-d96.zip", d96, CRS.from_epsg(3794).to_wkt("WKT1_ESRI"))
print("ok", len(refs), "points")
