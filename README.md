# Obsidian-Nominatim
This Plugin fills YAML-Frontmatter automatically with address and coordinates via [Nominatim]([url](https://nominatim.openstreetmap.org/ui/search.html)). It recognizes the properties "address" (property type: text) or "location" (property type: list) and asks to completes the existing property with the missing one.
- If 'address' exists → writes location: ["lat", "lon"]
- If 'location' exists → writes address: "text"
