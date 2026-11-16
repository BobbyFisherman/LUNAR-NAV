# LUNAR / NAV — Lunar Mission Planner

Interactive NASA Space Apps Challenge 2026 project focused on **Sun and Earth visibility at lunar landing sites**.

## Demo

Open `index.html` in a browser, or serve the directory locally:

```bash
python3 -m http.server 8000
```

Then navigate to `http://localhost:8000`.

## Project features

- Lunar site selection and shared mission date/time
- Sun and Earth local-horizon visibility (with optional imported terrain horizon)
- Cross-site comparison of visibility windows
- Simplified spacecraft transfer, energy, and communications analyses
- Interactive lunar rover exploration

## Data and limitations

The visualizations use NASA/JPL references and a bundled approximate ephemeris. The spacecraft transfers, lander hazard assessments, and rover terrain are educational models, not certified mission-planning calculations. For terrain-dependent skyline obstruction, a compatible NASA LOLA elevation tile must be imported; no verified high-resolution DEM is preloaded for arbitrary lunar locations.

NASA source citations and scientific limitations are documented in `SCIENCE_RELEASE_NOTES.md` and `SUBMISSION_NOTES.md`. The LROC Moon texture and optional 3D asset can be downloaded with the included helper scripts where network access permits.

## Publish with GitHub Pages

Create a **public** GitHub repository, upload all files from the root of this folder, then in **Settings → Pages**, choose **Deploy from a branch**, **main**, **/(root)**, and save. No build tool is required.

## Credits

Developed for NASA Space Apps Challenge 2026 with AI-assisted implementation. Includes NASA public reference imagery where fetched, and code/data dependencies documented in project sources. NASA does not certify or endorse this software.
