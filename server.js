const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");
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

app.use(express.static("public"));

function getBaseName(originalname = "") {
  const withoutExtension = originalname.replace(/\.[^.\\/]+$/, "");
  const sanitized = withoutExtension.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();

  return sanitized || "converted";
}

function normalizeToEpsg4326(geojson, baseName) {
  if (!geojson || !Array.isArray(geojson.features)) {
    throw new Error("KMZ/KML conversion failed or produced empty data.");
  }

  const normalizedFeatures = geojson.features.filter(Boolean).map((feature) => ({
    ...feature,
    // KML coordinates are lon/lat (WGS84). Keep data explicitly tagged.
    crs: {
      type: "name",
      properties: {
        name: "EPSG:4326"
      }
    }
  }));

  return {
    type: "FeatureCollection",
    name: baseName,
    crs: {
      type: "name",
      properties: {
        name: "EPSG:4326"
      }
    },
    features: normalizedFeatures
  };
}

function isZipBuffer(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function sanitizeKmlText(text) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function readKmlTextFromUpload(buffer, originalname = "") {
  const lowerName = originalname.toLowerCase();
  const isKmz = lowerName.endsWith(".kmz") || isZipBuffer(buffer);

  if (isKmz) {
    const zip = new AdmZip(buffer);
    const kmlEntries = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".kml"));

    const kmlEntry =
      kmlEntries.find((entry) => entry.entryName.toLowerCase().endsWith("doc.kml")) ||
      kmlEntries[0];

    if (!kmlEntry) {
      throw new Error("No KML file found inside the KMZ archive.");
    }

    return sanitizeKmlText(kmlEntry.getData().toString("utf8"));
  }

  if (lowerName.endsWith(".kml") || !isZipBuffer(buffer)) {
    return sanitizeKmlText(buffer.toString("utf8"));
  }

  throw new Error("Please upload a .kmz or .kml file.");
}

function parseKmlDocument(kmlText) {
  const document = new DOMParser().parseFromString(kmlText, "text/xml");
  const parseError = document.getElementsByTagName("parsererror")[0];

  if (parseError) {
    throw new Error(parseError.textContent || "Invalid KML XML.");
  }

  return document;
}

app.post("/api/convert", upload.single("kmlFile"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Please upload a .kmz or .kml file." });
    }

    const baseName = getBaseName(req.file.originalname);
    const kmlText = readKmlTextFromUpload(req.file.buffer, req.file.originalname);
    const document = parseKmlDocument(kmlText);
    const geojson = tj.kml(document);
    const normalizedGeojson = normalizeToEpsg4326(geojson, baseName);

    if (!normalizedGeojson.features.length) {
      return res.status(400).json({ error: "No geometries found in the KMZ/KML file." });
    }

    const zipBuffer = shpwrite.zip(normalizedGeojson, {
      folder: `${baseName}/${baseName}`,
      outputType: "nodebuffer",
      compression: "DEFLATE",
      types: {
        point: "points",
        polygon: "polygons",
        polyline: "lines"
      }
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.zip"`);
    return res.send(zipBuffer);
  } catch (error) {
    return res.status(500).json({
      error: "Conversion failed. Confirm the file is valid KMZ/KML in WGS84/EPSG:4326.",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`KMZ/KML to Shapefile server running at http://localhost:${PORT}`);
});
