/* Downloading the optional NASA terrain model locally: python3 get_nasa_visual_assets.py */
const cdn='https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js';
try {
  const local=await fetch('model-viewer.min.js',{method:'HEAD'}).then(r=>r.ok);
  await import(local?'./model-viewer.min.js':cdn);
} catch (err) {
  console.info('NASA 3D renderer unavailable without its optional network assets. Coordinate map remains available.');
}
