# LUNAR/NAV — NASA Space Apps 2026 Submission Kit

## Project title
LUNAR / NAV — Lunar Landing Site & Mission Planner

## Summary (50–200 words)
LUNAR/NAV is an interactive lunar landing-site and mission-planning application developed for NASA Space Apps 2026’s Lunar Landing Site Navigator challenge. Users select lunar coordinates or notable landing regions, choose a date, and visualize the Sun and Earth relative to the lunar horizon. A single mission clock connects six modules, making it easy to explore changing conditions. The tool compares candidate sites using sunlight availability, direct-Earth visibility, their simultaneous availability, and the longest periods of darkness or communication loss. It also provides a terrain-screening interface, spacecraft energy and communication estimates, a mission trajectory visualization, and a playable lunar rover expedition. NASA resources inform its lunar map, physical constants, and terrain-data workflow; a NASA LOLA elevation tile can be imported for local horizon analysis. LUNAR/NAV turns complex lunar planning concepts into an approachable experience for students, educators, and mission-planning enthusiasts while identifying where additional measurements are needed.

## Project Details
LUNAR/NAV addresses a practical lunar-exploration question: where and when could a spacecraft have access to sunlight for electrical power and a direct line of sight to Earth for communications? These conditions are particularly challenging near the Moon’s south pole, where the Sun remains close to the horizon and small differences in terrain and timing can affect a mission.

HOW IT WORKS
A user chooses a site using a rotatable lunar globe, named locations, or latitude/longitude coordinates. One shared UTC mission clock drives the celestial visualizations throughout the application. For dates from 2026–2029, the app uses a bundled two-hour astronomical ephemeris with interpolation to estimate the Sun’s and Earth’s apparent positions in the lunar sky. Sun and Earth elevation angles are computed against the local geometric horizon. If the user imports a compatible NASA Lunar Reconnaissance Orbiter / LOLA elevation tile, the application can derive a local skyline from that terrain and test whether nearby peaks obstruct the Sun or Earth. Without terrain coverage, it explicitly reports geometric rather than measured terrain-horizon visibility.

The comparison module evaluates multiple candidate sites over configurable 3-, 7-, 14-, or 28-day periods. It calculates the percentage of time the Sun is visible, Earth is visible, and both are visible together. It also reports the longest periods without sunlight and without direct-Earth visibility, plus a transparent weighted opportunity score.

SIX CONNECTED MODULES
1. Site & Light: lunar coordinate selection, landing ellipse, terrain screening, Sun/Earth horizon view, and optional NASA elevation import.
2. Transfer: time-controlled Earth–Moon and heliocentric diagrams, spacecraft presets, custom vehicle specifications, and illustrative delta-v and fuel calculations.
3. Power: estimates of spacecraft-specific generation, usage, and battery status, including sunlight and eclipse conditions.
4. Connections: direct-Earth visibility, frequency-band concepts, light-time estimates, and proposed lunar relay architecture.
5. Surface: an educational lunar rover expedition using NASA’s lunar gravity reference, obstacle avoidance, sample collection, and a research-base objective.
6. Compare: simultaneous solar/communications windows and trade-offs across candidate landing sites and dates.

TOOLS AND TECHNOLOGIES
The project uses HTML, CSS, vanilla JavaScript, SVG, Canvas, WebGL 2, and a static local/public web deployment. Optional Python terrain processing uses NumPy, SciPy, Rasterio, and PyProj to convert NASA LOLA GeoTIFF data into a site-specific height and horizon grid. NASA’s CGI Moon Kit/LROC mosaic and 3D model are referenced for lunar visualization; NASA/JPL publications provide physical parameters and orbital-element references. The embedded astronomical ephemeris is derived from the Swiss Ephemeris Moshier method with an approximate lunar-orientation model, not from live NASA SPICE.

INTENDED IMPACT AND LIMITATIONS
LUNAR/NAV makes lunar site/date analysis easier to understand for students and first-time users while connecting scientific observations to engineering decisions. It is a student-developed interactive prototype, not NASA-certified flight software. Its orbital trajectory, rover terrain, some spacecraft specifications, and unmeasured landing hazards are simplified. High-confidence terrain-obstruction calculations require a compatible NASA elevation tile for the selected location. This distinction prevents the interface from misrepresenting missing measurements as verified safe conditions.

AI USE
OpenAI ChatGPT assisted with interface design, software development, research organization, and debugging. The project’s results and source limitations are documented for review.

## NASA Data and Resources — Link Text | Link URL
- **NASA Space Apps — Lunar Landing Site Navigator Challenge** — https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/  
  Use: Official challenge question and requirements.
- **NASA Scientific Visualization Studio — CGI Moon Kit (LROC imagery)** — https://svs.gsfc.nasa.gov/4720/  
  Use: NASA LROC-derived lunar map texture requested by the app; optional local download.
- **NASA Moon Trek** — https://trek.nasa.gov/moon/  
  Use: NASA lunar basemap and visualization/reference.
- **NASA GSFC PGDA — High-Resolution LOLA South Pole Topography** — https://pgda.gsfc.nasa.gov/products/78  
  Use: Official elevation data supported by optional terrain import; not preloaded.
- **NASA NSSDC — Moon Fact Sheet** — https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html  
  Use: Lunar gravity, radius, and physical parameters.
- **NASA/JPL — Astrodynamic Parameters** — https://ssd.jpl.nasa.gov/astro_par.html  
  Use: Physical constants for orbital mechanics.
- **NASA/JPL — Approximate Positions of the Planets** — https://ssd.jpl.nasa.gov/planets/approx_pos.html  
  Use: Earth-orbit reference model for heliocentric animation.
- **NASA Goddard — 3D Moon Models for Web** — https://svs.gsfc.nasa.gov/14959/  
  Use: Referenced optional lunar 3D visualization.
- **NASA/LROC QuickMap** — https://quickmap.lroc.asu.edu/  
  Use: Reference tool for high-resolution lunar imagery and features.
- **NASA Earth Observatory — Blue Marble** — https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/  
  Use: Earth appearance imagery source used when online.
- **NASA SDO/HMI Solar Imagery** — https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg  
  Use: Solar-visualization photo when online; not time-synchronized.

## Space Agency Partner & Other Data — Link Text | Link URL
- **Astrodienst — Swiss Ephemeris / Moshier astronomical calculation method** — https://www.astro.com/swisseph/swephinfo_e.htm  
  Use: Source method used to generate bundled approximate Sun/Moon ephemeris values.
- **Swiss Ephemeris Documentation and License** — https://www.astro.com/swisseph-download/doc/swisseph.pdf  
  Use: Method and licensing reference; original Swiss Ephemeris library not shipped.
- **Google — model-viewer** — https://modelviewer.dev/  
  Use: Optional 3D Moon model viewing component.
- **MDN — WebGL 2 API** — https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext  
  Use: Technical reference for rover 3D renderer.
- **NumPy** — https://numpy.org/  
  Use: Optional elevation preprocessing.
- **SciPy** — https://scipy.org/  
  Use: Optional slope/roughness preprocessing.
- **Rasterio** — https://rasterio.readthedocs.io/  
  Use: Optional NASA elevation GeoTIFF reading.
- **PyProj** — https://pyproj4.github.io/pyproj/stable/  
  Use: Optional lunar coordinate projection.
- **SpaceGenes+ (design inspiration only)** — https://spacegenes-plus.framer.website/  
  Use: Editorial story-first layout inspiration; no design assets/code copied.
- **OpenAI ChatGPT** — https://chatgpt.com/  
  Use: AI assistance for code, UI, research organization and testing.

## Links to paste before submitting
- Final project link: [insert your public URL after publishing]
- Demonstration link: [insert public link to the 7-slide PDF]

## Fast publication without GitHub
1. Open https://app.netlify.com/drop and drag the **LUNAR_NAV_PUBLIC_SITE** folder.
2. Copy the generated .netlify.app URL; open it in a private browser window and test all pages.
3. Upload LUNAR_NAV_7_Slide_Demo.pdf to Google Drive, enable Anyone with the link → Viewer, and test its link in a private window.
4. Paste both URLs into the NASA Space Apps Project tab and submit before the deadline.

## Scientific honesty
Only the NASA physical parameters, external NASA references, astronomical ephemeris calculations and optional NASA elevation processing are grounded in the cited methods. The 92% safe-area setting, 100 m×75 m ellipse, synthetic hazards, rover, relay configuration, power assumptions and trajectory preview are model choices or educational simulations, not NASA safety certification.
