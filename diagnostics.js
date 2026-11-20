// Illustrative triage rules for the demo machine. Part IDs locate candidates on the model.
const rules = [
  {
    hazard: true,
    pattern: /\b(?:smoke|sparks?|burning smell|electrical shock|breaker (?:trips?|tripped)|tripp\w* (?:the )?breaker|(?:blows?|blew) (?:a |the )?fuse|water (?:pooling|leaking) (?:from )?(?:under|inside)|(?:steam|hot water) (?:pouring|spraying) (?:everywhere|(?:out )?(?:of|from) (?:the )?(?:group head|body|case))|(?:steam|hot water) won't (?:stop|shut off))\b/,
    summary: 'Stop using the machine and arrange qualified service.',
    causes: [],
    checks: ['Stay clear of standing water or escaping steam. Switch the machine off only if the controls are safe to reach.', 'Have the machine inspected before using it again.'],
  },
  {
    pattern: /\b(?:(?:leak\w*|dripp?\w*|seep\w*|coming out|runs out).{0,40}(?:handle|portafilter|group head)|(?:handle|portafilter|group head).{0,28}(?:leak\w*|dripp\w*|seep\w*|runs out)|(?:cracked|worn|damaged) (?:group head )?(?:seal|gasket))\b/,
    summary: 'A leak around the portafilter can come from the basket rim or the group head seal.',
    causes: [
      { title: 'Portafilter seating or dirty basket rim', description: 'Coffee grounds on the rim or a poorly seated handle can leave a gap.', partIds: ['portafilter-left', 'portafilter-right'] },
      { title: 'Worn group head seal', description: 'A cracked, hardened, or uneven seal can let water escape during brewing.', partIds: ['seal', 'seal-right'] },
    ],
    checks: ['Switch off and let the machine cool fully. Check the basket rim for coffee grounds.', 'Look for cracking or uneven seating on the visible seal.'],
  },
  {
    pattern: /\b(?:(?:water|flow).{0,35}(?:into|to|from|through) (?:the )?drip tray.{0,28}(?:instead|when|while|during)|(?:during|while|when) (?:a shot|brewing|brew\w*).{0,28}drip tray|(?:drains?|dumps?).{0,26}drip tray|(?:valve|solenoid).{0,22}(?:stuck|clogged|blocked|click\w*)|only one (?:brew )?group works)\b/,
    summary: 'Water diverted during the shot may point to the brew valve or a restricted group head.',
    causes: [
      { title: 'Brew valve may be sticking', description: 'The valve directs water between the brew group and drain. The timing of the drainage matters.', partIds: ['solenoid-valve'] },
      { title: 'Restricted brew group', description: 'If the other group works normally, the trouble may be local to the affected side.', partIds: ['shower-screen-left', 'shower-screen-right'] },
    ],
    checks: ['Note if water enters the tray during the shot or briefly afterward. Brief drainage afterward can be normal.', 'Record whether the issue affects one group or both for service.'],
  },
  {
    pattern: /\b(?:(?:no|weak|little|low|lost|without) (?:more )?(?:steam|froth)|steam.{0,22}(?:weak|low|none|stopped|not working|won't)|(?:steam wand|milk frother).{0,28}(?:blocked|clogged|doesn't work|won't|stopped)|(?:not|isn't|stopped) steam\w*)\b/,
    summary: 'Weak or missing steam can come from a blocked wand or the steam system.',
    causes: [
      { title: 'Blocked steam wand tip', description: 'Dried milk can restrict steam at the outlet, especially if only one wand is affected.', partIds: ['steam-wand-left', 'steam-wand-right'] },
      { title: 'Steam pressure regulation', description: 'Weak steam on both sides after warm-up can warrant a check of the steam system by a technician.', partIds: ['pressure-switch', 'steam-boiler'] },
    ],
    checks: ['Check the ready indicator and note whether one side or both are affected.', 'Once the machine is cool, look for visible residue on the wand and follow the manufacturer’s external cleaning instructions.'],
  },
  {
    pattern: /\b(?:(?:won't|will not|doesn't|does not|cannot|can't|not|never) (?:heat(?:ing)?|warm up|get hot)|(?:cold|lukewarm|tepid) (?:shots?|coffee|espresso|water)|(?:shots?|coffee|espresso|water).{0,18}(?:cold|lukewarm|tepid|not hot enough)|not heating|heat\w* (?:stopped|stays off))\b/,
    summary: 'The issue may be normal warm-up or a fault in the brew heating system.',
    causes: [
      { title: 'Brew heating or control fault', description: 'If brew water stays cool after warm-up, a technician can check the brew boiler and its controls.', partIds: ['brew-boiler', 'control-board'] },
      { title: 'Steam boiler heater', description: 'If steaming also fails after warm-up, the steam boiler heater is a separate part to check during service.', partIds: ['heating-element'] },
    ],
    checks: ['Check the ready indicator and normal warm-up time in the operator manual.', 'Note whether steam works normally and whether the display shows a temperature or error.'],
  },
  {
    pattern: /\b(?:no power|dead screen|blank display|display (?:blank|dead)|(?:won't|will not|doesn't|does not|cannot|can't) (?:turn on|power on|start up)|(?:buttons?|controls?|display).{0,20}(?:unresponsive|not responding|not working|won't respond|stopped)|(?:unresponsive|dead) (?:buttons?|controls?|display))\b/,
    summary: 'A dark or unresponsive control panel can point to external power or a control fault.',
    causes: [
      { title: 'Power supply or control board', description: 'If the machine has normal external power and the panel stays dark, service can narrow down the fault.', partIds: ['control-board'] },
    ],
    checks: ['Check the machine’s power switch and look for an error or power light.', 'If it is a plug-in model, visually check that the cord is connected and undamaged. Arrange service if the panel remains dark.'],
  },
  {
    pattern: /\b(?:(?:no|little|low|weak) (?:brew )?(?:water(?! steam)|flow)|(?:no|low|weak) brew pressure|water.{0,20}(?:won't|doesn't|does not|not) (?:come|flow|dispense)|water.{0,15}(?:isn't|is not) (?:coming|flowing)|(?:won't|doesn't|does not|stopped|can't|cannot) brew|(?:pump|pumping).{0,35}(?:hum\w*|buzz\w*|loud\w*|nois\w*|rattl\w*|not running|won't start|doesn't start)|(?:loud\w*|nois\w*|buzz\w*|hum\w*|rattl\w*).{0,25}(?:pump|pumping))\b/,
    summary: 'Low water flow or a noisy pump can come from the water supply, a restriction, or the pump.',
    causes: [
      { title: 'Water supply or inlet restriction', description: 'A closed supply valve, empty tank, or restricted inlet can leave the pump short of water.', partIds: ['inlet-hose'] },
      { title: 'Pump or brew valve fault', description: 'With a confirmed water supply, a persistent hum or lack of flow can help a technician isolate the pump or valve.', partIds: ['water-pump', 'solenoid-valve'] },
    ],
    checks: ['Check the water level if the machine has a tank, or the visible external water supply if it is plumbed in.', 'Note whether the pump makes noise and whether the fault affects both brew groups.'],
  },
];

export function diagnoseSymptom(text) {
  const symptom = String(text ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/[-–]/g, ' ').trim();
  const hazards = symptom.replace(/\b(?:no|without) (?:signs of )?(?:smoke|sparks?|burning smell)(?:(?: or| and) (?:smoke|sparks?|burning smell))?\b/g, '');
  const rule = rules.find(({ hazard, pattern }) => pattern.test(hazard ? hazards : symptom));
  if (!rule) {
    return {
      status: 'needs-detail',
      summary: 'I need one more detail to suggest a possible cause.',
      clarification: 'What happens when you try to brew or steam? For example, does the pump hum, does water leak around the handle, or does the display stay dark?',
      causes: [],
      checks: [],
    };
  }

  const sides = new Set(Array.from(symptom.matchAll(/\b(left|right)(?: hand)? (?:side|portafilter|handle|group|wand)\b/g), ([, side]) => side));
  const oppositeSuffix = sides.has('left') ? '-right' : '-left';
  const causes = rule.causes.map((cause) => {
    const partIds = [...cause.partIds];
    if (sides.size !== 1) return { ...cause, partIds };

    return {
      ...cause,
      partIds: partIds.filter((id) => !(id === 'seal' ? 'seal-left' : id).endsWith(oppositeSuffix)),
    };
  });

  return {
    status: 'matched',
    summary: rule.summary,
    causes,
    checks: [...rule.checks],
    clarification: null,
  };
}
