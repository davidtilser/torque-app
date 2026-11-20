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
      { title: 'Portafilter seating or dirty basket rim', description: 'Coffee grounds on the rim or a poorly seated handle can leave a gap.', partIds: ['portafilter'] },
      { title: 'Worn group head seal', description: 'A cracked, hardened, or uneven seal can let water escape during brewing.', partIds: ['seal'] },
    ],
    checks: ['Switch off and let the machine cool fully. Check the basket rim for coffee grounds.', 'Look for cracking or uneven seating on the visible seal.'],
  },
  {
    pattern: /\b(?:(?:water|flow).{0,35}(?:into|to|from|through) (?:the )?drip tray.{0,28}(?:instead|when|while|during)|(?:during|while|when) (?:a shot|brewing|brew\w*).{0,28}drip tray|(?:drains?|dumps?).{0,26}drip tray|(?:valve|solenoid).{0,22}(?:stuck|clogged|blocked|click\w*)|only the steam wand works)\b/,
    summary: 'Water diverted during the shot may point to the brew valve or a restricted group head.',
    causes: [
      { title: 'Brew valve may be sticking', description: 'The valve directs water between the brew group and drain. The timing of the drainage matters.', partIds: ['solenoid-valve'] },
      { title: 'Restricted brew group', description: 'If the pump runs but flow is weak at the group, check for buildup at the shower screen.', partIds: ['shower-screen'] },
    ],
    checks: ['Note if water enters the tray during the shot or briefly afterward. Brief drainage afterward can be normal.', 'Note whether hot water still comes through the steam wand.'],
  },
  {
    pattern: /\b(?:(?:no|weak|little|low|lost|without) (?:more )?(?:steam|froth)|steam.{0,22}(?:weak|low|none|stopped|not working|won't)|(?:steam wand|milk frother).{0,28}(?:blocked|clogged|doesn't work|won't|stopped)|(?:not|isn't|stopped) steam\w*)\b/,
    summary: 'Weak or missing steam can come from a blocked wand or the steam system.',
    causes: [
      { title: 'Blocked steam wand tip', description: 'Dried milk can restrict steam at the outlet, around the outlet.', partIds: ['steam-wand'] },
      { title: 'Steam pressure regulation', description: 'Weak steam after warm-up can warrant checking the steam thermostat and boiler.', partIds: ['steam-thermostat', 'boiler'] },
    ],
    checks: ['Check the heating indicator and note whether the machine still brews normally.', 'Once the machine is cool, look for visible residue on the wand and follow the manufacturer’s external cleaning instructions.'],
  },
  {
    pattern: /\b(?:(?:won't|will not|doesn't|does not|cannot|can't|not|never) (?:heat(?:ing)?|warm up|get hot)|(?:cold|lukewarm|tepid) (?:shots?|coffee|espresso|water)|(?:shots?|coffee|espresso|water).{0,18}(?:cold|lukewarm|tepid|not hot enough)|not heating|heat\w* (?:stopped|stays off))\b/,
    summary: 'The issue may be normal warm-up or a fault in the brew heating system.',
    causes: [
      { title: 'Brew heating or control fault', description: 'If brew water stays cool after warm-up, a technician can check the brew boiler and its controls.', partIds: ['boiler', 'brew-thermostat'] },
      { title: 'Shared boiler heater', description: 'If steaming also fails after warm-up, the shared boiler’s heating element is another part to check during service.', partIds: ['heating-element'] },
    ],
    checks: ['Check the ready indicator and normal warm-up time in the operator manual.', 'Note whether steam works normally and whether the display shows a temperature or error.'],
  },
  {
    pattern: /\b(?:no power|dead screen|blank display|display (?:blank|dead)|(?:won't|will not|doesn't|does not|cannot|can't) (?:turn on|power on|start up)|(?:buttons?|controls?|display).{0,20}(?:unresponsive|not responding|not working|won't respond|stopped)|(?:unresponsive|dead) (?:buttons?|controls?|display))\b/,
    summary: 'An unlit power switch can point to external power or a switch fault.',
    causes: [
      { title: 'Power supply or power switch', description: 'If the machine has normal external power and the machine stays off, service can narrow down the fault.', partIds: ['power-switch'] },
    ],
    checks: ['Check the machine’s power switch and look for an error or power light.', 'If it is a plug-in model, visually check that the cord is connected and undamaged. Arrange service if the machine remains off.'],
  },
  {
    pattern: /\b(?:(?:no|little|low|weak) (?:brew )?(?:water(?! steam)|flow)|(?:no|low|weak) brew pressure|water.{0,20}(?:won't|doesn't|does not|not) (?:come|flow|dispense)|water.{0,15}(?:isn't|is not) (?:coming|flowing)|(?:won't|doesn't|does not|stopped|can't|cannot) brew|(?:pump|pumping).{0,35}(?:hum\w*|buzz\w*|loud\w*|nois\w*|rattl\w*|not running|won't start|doesn't start)|(?:loud\w*|nois\w*|buzz\w*|hum\w*|rattl\w*).{0,25}(?:pump|pumping))\b/,
    summary: 'Low water flow or a noisy pump can come from the water supply, a restriction, or the pump.',
    causes: [
      { title: 'Water supply or inlet restriction', description: 'A low reservoir or restricted inlet hose can leave the pump short of water.', partIds: ['inlet-hose'] },
      { title: 'Pump or brew valve fault', description: 'If the reservoir is full and the group still has no flow, have a technician check the pump and three-way valve.', partIds: ['water-pump', 'solenoid-valve'] },
    ],
    checks: ['Check the water level in the Silvia’s reservoir.', 'Note whether the pump makes noise and whether water drains into the drip tray.'],
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

  return {
    status: 'matched',
    summary: rule.summary,
    causes: rule.causes.map((cause) => ({ ...cause, partIds: [...cause.partIds] })),
    checks: [...rule.checks],
    clarification: null,
  };
}
