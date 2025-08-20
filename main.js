/*
Obsidian Plugin: Nominatim
Automatically fills YAML frontmatter with address or coordinates using OpenStreetMap Nominatim.
- If 'address' exists → writes location: ["lat", "lon"]
- If 'location' exists → writes address
All values are stored as strings in quotes to maintain consistency.
*/

const { Plugin } = require('obsidian');

module.exports = class NominatimPlugin extends Plugin {
  async onload() {
    // Register an event listener to detect changes in files
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

      // If 'address' exists but 'location' does not or is invalid, geocode address
      if (fm.address && (!fm.location || fm.location.length !== 2)) {
        const coords = await this.geocodeAddress(fm.address);
        if (coords) {
          newFm.location = [coords.lat, coords.lon]; // keep as strings
        }
      } 
      // If 'location' exists but 'address' does not, reverse geocode
      else if (fm.location && fm.location.length === 2 && !fm.address) {
        const [lat, lon] = fm.location;
        const addr = await this.reverseGeocode(lat, lon);
        if (addr) {
          newFm.address = addr;
        }
      }

      // Only write if there is a real change to prevent duplicate frontmatter
      if (JSON.stringify(fm) !== JSON.stringify(newFm)) {
        await this.writeFrontmatter(file, newFm);
      }
    } catch (e) {
      console.error("Nominatim plugin error", e);
    }
  }

  // Convert an address into coordinates using Nominatim
  async geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Obsidian-Nominatim' } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: data[0].lat, lon: data[0].lon };
    }
    return null;
  }

  // Convert coordinates into a human-readable address using Nominatim
  async reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Obsidian-Nominatim' } });
    const data = await res.json();
    return data?.display_name || null;
  }

  // Write the updated frontmatter back to the note
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

  // Convert a JavaScript object to YAML, keeping all values as strings in quotes
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
