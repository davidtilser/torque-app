// Triangle ranges for the bundled Tevy espresso machine v1 LOD0. The asset merges
// the body into one mesh, so these ranges restore the selectable assemblies.
function expandFaces(ranges) {
  const parts = new Array(ranges.at(-1)[0]);
  let start = 0;
  for (const [end, part] of ranges) {
    parts.fill(part, start, end);
    start = end;
  }
  return parts;
}

export const bodyFaceParts = expandFaces([
  [332, 'side-panel-left'],
  [664, 'side-panel-right'],
  [804, 'front-panel'],
  [944, 'top-panel'],
  [1084, 'rear-panel'],
  [1364, 'front-panel'],
  [1504, 'chassis'],
  [1784, 'front-panel'],
  [2344, 'drip-tray'],
  [3424, 'drip-grate'],
  [3584, 'foot-front-left'],
  [3744, 'foot-rear-left'],
  [3904, 'foot-front-right'],
  [4064, 'foot-rear-right'],
  [4704, 'brew-head-left'],
  [4734, 'shower-screen-left'],
  [4926, 'brew-head-left'],
  [4986, 'control-panel-left'],
  [5082, 'brew-button-left-1'],
  [5178, 'brew-button-left-2'],
  [5274, 'brew-button-left-3'],
  [5370, 'brew-button-left-4'],
  [6010, 'brew-head-right'],
  [6040, 'shower-screen-right'],
  [6232, 'brew-head-right'],
  [6292, 'control-panel-right'],
  [6388, 'brew-button-right-1'],
  [6484, 'brew-button-right-2'],
  [6580, 'brew-button-right-3'],
  [6676, 'brew-button-right-4'],
  [7026, 'pressure-gauge-left'],
  [7376, 'pressure-gauge-right'],
  [7772, 'steam-knob-left'],
  [8168, 'water-knob'],
  [8564, 'steam-knob-right'],
  [8708, 'hot-water-spout'],
  [8732, 'steam-wand-left'],
  [8756, 'steam-wand-right'],
  [9444, 'cup-rail'],
]);

export const gaugeFaceParts = expandFaces([
  [144, 'pressure-gauge-left'],
  [288, 'pressure-gauge-right'],
]);
