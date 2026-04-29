const form = document.getElementById("convertForm");
const fileInput = document.getElementById("kmlFile");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#027a48";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    setStatus("Please choose a KML file.", true);
    return;
  }

  const data = new FormData();
  data.append("kmlFile", file);

  setStatus("Converting file...");

  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      body: data
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Conversion failed");
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "agras_t50_epsg4326.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);

    setStatus("Done. ZIP downloaded successfully.");
  } catch (error) {
    setStatus(error.message || "Unexpected conversion error.", true);
  }
});
