/*
Obsidian Plugin: Nominatim
It fills YAML frontmatter with address or coordinates using OpenStreetMap Nominatim.
- If 'address' exists → writes location: ["lat", "lon"]
- If 'location' exists → writes address: "text"
created with ChatGPT
*/

const { Plugin, Modal, Notice } = require('obsidian');

module.exports = class NominatimPlugin extends Plugin {
  async onload() {
    // Trigger when file is opened
this.registerEvent(
  this.app.workspace.on("file-open", async (file) => {
    if (file) {
      await this.updateFrontmatter(file);
    }
  })
);

// Trigger when metadata changes
this.registerEvent(
  this.app.metadataCache.on("changed", async (file) => {
    await this.updateFrontmatter(file);
  })
);

  }

  async updateFrontmatter(file) {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) return;

      const fm = { ...cache.frontmatter };
      let newFm = { ...fm };

      let needsUpdate = false;

      // Case 1: address exists, location missing
      if (fm.address && (!fm.location || fm.location.length !== 2)) {
        const coords = await this.geocodeAddress(fm.address);
        if (coords) {
          newFm.location = [coords.lat, coords.lon];
          needsUpdate = true;
        }
      }
      // Case 2: location exists, address missing
      else if (fm.location && fm.location.length === 2 && !fm.address) {
        const [lat, lon] = fm.location;
        const addr = await this.reverseGeocode(lat, lon);
        if (addr) {
          newFm.address = addr;
          needsUpdate = true;
        }
      }

      // Ask user before writing
      if (needsUpdate && JSON.stringify(fm) !== JSON.stringify(newFm)) {
        new ConfirmModal(this.app, async () => {
          await this.writeFrontmatter(file, newFm);
          new Notice(`Nominatim: Updated frontmatter in "${file.basename}"`);
        }, file.basename).open();
      }
    } catch (e) {
      console.error("Nominatim plugin error", e);
    }
  }

  async geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Obsidian-Nominatim' } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: data[0].lat, lon: data[0].lon };
    }
    return null;
  }

  async reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Obsidian-Nominatim' } });
    const data = await res.json();
    return data?.display_name || null;
  }

  async writeFrontmatter(file, newFm) {
    const content = await this.app.vault.read(file);
    const yamlRegex = /^---\n([\s\S]*?)\n---/;
    const yamlMatch = content.match(yamlRegex);
    let newYaml = this.objToYaml(newFm);
    let newContent;

    if (yamlMatch) {
      newContent = content.replace(yamlRegex, `---\n${newYaml}\n---`);
    } else {
      newContent = `---\n${newYaml}\n---\n` + content;
    }

    await this.app.vault.modify(file, newContent);
  }

  objToYaml(obj) {
    return Object.entries(obj)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `${k}:\n  - "${v[0]}"\n  - "${v[1]}"`;
        } else {
          return `${k}: "${v}"`;
        }
      })
      .join("\n");
  }
};

// A simple confirmation modal
class ConfirmModal extends Modal {
  constructor(app, onConfirm, filename) {
    super(app);
    this.onConfirm = onConfirm;
    this.filename = filename;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Nominatim" });
    contentEl.createEl("p", { text: `Do you want to nominatim the "address" or "location"?`});

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

    const okBtn = buttonContainer.createEl("button", { text: "Yes" });
    okBtn.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });

    const cancelBtn = buttonContainer.createEl("button", { text: "No" });
    cancelBtn.addEventListener("click", () => {
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
