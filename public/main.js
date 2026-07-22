const form = document.getElementById("convertForm");
const fileInput = document.getElementById("kmlFile");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b42318" : "#027a48";
}

function buildServerErrorMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return "Conversion failed";
  }

  const mainError = typeof payload.error === "string" ? payload.error.trim() : "";
  const details = typeof payload.details === "string" ? payload.details.trim() : "";

  if (mainError && details) {
    return `${mainError}\nDetails: ${details}`;
  }

  return mainError || details || "Conversion failed";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    setStatus("Please choose a KMZ or KML file.", true);
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
      throw new Error(buildServerErrorMessage(payload));
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition");
    const filenameMatch = disposition?.match(/filename="([^"]+)"/);
    const downloadName = filenameMatch?.[1] || "converted.zip";
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(downloadUrl);

    setStatus("Done. ZIP downloaded successfully.");
  } catch (error) {
    setStatus(error.message || "Unexpected conversion error.", true);
  }
});
