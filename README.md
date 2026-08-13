# KML / KMZ to Shapefile

A simple web app to convert **KML or KMZ field boundaries to ESRI Shapefile**, primarily designed for use with **DJI Agras agricultural drones**.

🌐 **Web app:**
https://kml-and-kmz-to-shapefile.vercel.app/

## Intended Use

This tool was created to simplify the workflow of importing field boundaries into DJI Agras remote controllers.

It is specifically intended for **agricultural field polygons**, rather than general-purpose GIS file conversion.

Tested with:

* DJI Agras T50
* DJI Agras T100

The generated Shapefile uses **WGS84 / EPSG:4326**.

## How to Use

1. Select a `.kml` or `.kmz` file containing the field boundary.
2. Click **Convert**.
3. The app converts the polygon and downloads a `.zip` containing the Shapefile.
4. Extract the ZIP file.
5. Copy the generated Shapefile files to the controller's memory card.

For DJI Agras controllers, use:

```text
SD Card/disk/dji/ShapeFile
```

Then import the Shapefile from the DJI Agras controller.

## Geometry Handling

The converter is intentionally focused on field boundaries.

Supported:

* `Polygon`
* `MultiPolygon`

Ignored:

* `Point`
* `MultiPoint`
* `LineString`
* `MultiLineString`

Points and lines contained in the original KML/KMZ are deliberately removed from the output.

This is useful when KML files contain additional markers or reference points that should not be imported into the Agras field boundary.

## Output

The downloaded ZIP contains the standard ESRI Shapefile components, such as:

```text
field.shp
field.shx
field.dbf
field.prj
```

## Run Locally

Node.js is required.

Clone the repository:

```bash
git clone https://github.com/JoaquinAkerman/KML-and-KMZ-to-Shapefile.git
cd KML-and-KMZ-to-Shapefile
```

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

The application will be available at:

```text
http://localhost:3000
```

## Built With

* Node.js
* Express
* Multer
* @tmcw/togeojson
* shp-write
* adm-zip
* Vercel

## Why This Project?

This tool was originally built to simplify my own DJI Agras workflow.

There are several general-purpose online KML-to-Shapefile converters available, but this project is intentionally simple, ad-free, and focused on one task:

taking a KML/KMZ agricultural field boundary and preparing it for use on a DJI Agras controller.

If you find a KML/KMZ file that does not convert correctly, feel free to open an Issue.
