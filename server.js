const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");
const path = require("path");
const { DOMParser } = require("@xmldom/xmldom");
const tj = require("@tmcw/togeojson");
const shpwrite = require("shp-write");

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

const PORT = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, "public");

app.use(express.static(publicDirectory));

app.get("/", (req, res) => {
  res.redirect(302, "/index.html");
});

function getBaseName(originalname = "") {
  const withoutExtension = originalname.replace(/\.[^.\\/]+$/, "");

  const sanitized = withoutExtension
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();

  return sanitized || "convertido";
}

function addPolygonGeometries(geometry, properties, output) {
  if (!geometry) {
    return;
  }

  if (
    geometry.type === "Polygon" ||
    geometry.type === "MultiPolygon"
  ) {
    output.push({
      type: "Feature",
      properties: properties || {},
      geometry
    });

    return;
  }

  if (
    geometry.type === "GeometryCollection" &&
    Array.isArray(geometry.geometries)
  ) {
    for (const subGeometry of geometry.geometries) {
      addPolygonGeometries(
        subGeometry,
        properties,
        output
      );
    }
  }

  // Los puntos y las líneas se ignoran.
}

function normalizeToEpsg4326(geojson, baseName) {
  if (!geojson || !Array.isArray(geojson.features)) {
    throw new Error(
      "La conversión del archivo KML/KMZ falló o no produjo datos válidos."
    );
  }

  const polygonFeatures = [];

  for (const feature of geojson.features) {
    if (!feature || !feature.geometry) {
      continue;
    }

    addPolygonGeometries(
      feature.geometry,
      feature.properties,
      polygonFeatures
    );
  }

  return {
    type: "FeatureCollection",
    name: baseName,
    crs: {
      type: "name",
      properties: {
        name: "EPSG:4326"
      }
    },
    features: polygonFeatures
  };
}

function isZipBuffer(buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b
  );
}

function sanitizeKmlText(text) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function readKmlTextFromUpload(buffer, originalname = "") {
  const lowerName = originalname.toLowerCase();

  const isKmz =
    lowerName.endsWith(".kmz") ||
    isZipBuffer(buffer);

  if (isKmz) {
    const zip = new AdmZip(buffer);

    const kmlEntries = zip
      .getEntries()
      .filter(
        (entry) =>
          !entry.isDirectory &&
          entry.entryName
            .toLowerCase()
            .endsWith(".kml")
      );

    const kmlEntry =
      kmlEntries.find((entry) =>
        entry.entryName
          .toLowerCase()
          .endsWith("doc.kml")
      ) ||
      kmlEntries[0];

    if (!kmlEntry) {
      throw new Error(
        "No se encontró ningún archivo KML dentro del archivo KMZ."
      );
    }

    return sanitizeKmlText(
      kmlEntry.getData().toString("utf8")
    );
  }

  if (
    lowerName.endsWith(".kml") ||
    !isZipBuffer(buffer)
  ) {
    return sanitizeKmlText(
      buffer.toString("utf8")
    );
  }

  throw new Error(
    "Seleccioná un archivo .KML o .KMZ."
  );
}

function parseKmlDocument(kmlText) {
  const document = new DOMParser().parseFromString(
    kmlText,
    "text/xml"
  );

  const parseError =
    document.getElementsByTagName("parsererror")[0];

  if (parseError) {
    throw new Error(
      "El archivo KML contiene un error de formato XML."
    );
  }

  return document;
}

app.post(
  "/api/convert",
  upload.single("kmlFile"),
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          error: "Seleccioná un archivo .KML o .KMZ."
        });
      }

      const baseName = getBaseName(
        req.file.originalname
      );

      const kmlText = readKmlTextFromUpload(
        req.file.buffer,
        req.file.originalname
      );

      const document =
        parseKmlDocument(kmlText);

      const geojson =
        tj.kml(document);

      const normalizedGeojson =
        normalizeToEpsg4326(
          geojson,
          baseName
        );

      if (!normalizedGeojson.features.length) {
        return res.status(400).json({
          error:
            "El archivo no contiene ningún polígono válido para convertir."
        });
      }

      const zipBuffer = shpwrite.zip(
        normalizedGeojson,
        {
          folder: baseName,
          outputType: "nodebuffer",
          compression: "DEFLATE",
          types: {
            polygon: baseName
          }
        }
      );

      res.setHeader(
        "Content-Type",
        "application/zip"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${baseName}.zip"`
      );

      return res.send(zipBuffer);
    } catch (error) {
      return res.status(500).json({
        error:
          "No se pudo convertir el archivo. Verificá que sea un KML o KMZ válido.",
        details: error.message
      });
    }
  }
);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message:
      "El conversor KML/KMZ a Shapefile está funcionando."
  });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Servidor KML/KMZ a Shapefile funcionando en http://localhost:${PORT}`
    );
  });
}