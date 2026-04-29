const express = require("express");
const multer = require("multer");
const { JSDOM } = require("jsdom");
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

function normalizeToEpsg4326(geojson) {
  if (!geojson || !Array.isArray(geojson.features)) {
    throw new Error("KML conversion failed or produced empty data.");
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
    name: "agras_t50_wgs84",
    crs: {
      type: "name",
      properties: {
        name: "EPSG:4326"
      }
    },
    features: normalizedFeatures
  };
}

app.post("/api/convert", upload.single("kmlFile"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Please upload a .kml file." });
    }

    const kmlText = req.file.buffer.toString("utf8");
    const dom = new JSDOM(kmlText, { contentType: "text/xml" });
    const geojson = tj.kml(dom.window.document);
    const normalizedGeojson = normalizeToEpsg4326(geojson);

    if (!normalizedGeojson.features.length) {
      return res.status(400).json({ error: "No geometries found in the KML file." });
    }

    const zipBuffer = shpwrite.zip(normalizedGeojson, {
      folder: "agras_t50",
      filename: "agras_t50_epsg4326",
      outputType: "nodebuffer",
      compression: "DEFLATE",
      types: {
        point: "points",
        polygon: "polygons",
        polyline: "lines"
      }
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=\"agras_t50_epsg4326.zip\"");
    return res.send(zipBuffer);
  } catch (error) {
    return res.status(500).json({
      error: "Conversion failed. Confirm the file is valid KML in WGS84/EPSG:4326.",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`KML to Shapefile server running at http://localhost:${PORT}`);
});
