// Left and right are as seen from the front of the machine.
const componentGroups = {
  'Inside the machine': [
    ['steam-boiler', 'Steam boiler', 'Stores heated water to supply steam and hot water.', 'steam-boiler'],
    ['brew-boiler', 'Brew boiler', 'Heats the water supplied to the brew groups.', 'brew-boiler'],
    ['water-pump', 'Water pump', 'Moves water through the machine and builds brewing pressure.', 'water-pump'],
    ['solenoid-valve', 'Solenoid valve', 'Opens and closes the water path when electrically actuated.', 'solenoid-valve'],
    ['control-board', 'Control board', 'Coordinates the pump, heaters, and brewing controls.', 'control-board'],
    ['pressure-switch', 'Pressure switch', 'Responds to steam pressure to help regulate the boiler.', 'pressure-switch'],
    ['inlet-hose', 'Inlet hose', 'Carries incoming water to the pump.', 'inlet-hose'],
    ['heating-element', 'Heating element', 'The replaceable heater for the boiler assembly.', 'heating-element'],
  ],
  'Brewing': [
    ['seal', 'Left group head seal', 'The silicone gasket between the left group head and the portafilter.', 'seal'],
    ['seal-right', 'Right group head seal', 'The silicone gasket between the right group head and the portafilter.', 'seal'],
    ['portafilter-left', 'Left portafilter', 'The removable handled holder for the left brew group’s coffee basket.'],
    ['portafilter-right', 'Right portafilter', 'The removable handled holder for the right brew group’s coffee basket.'],
    ['brew-head-left', 'Left group head', 'The assembly where the left portafilter locks into the machine.'],
    ['brew-head-right', 'Right group head', 'The assembly where the right portafilter locks into the machine.'],
    ['shower-screen-left', 'Left shower screen', 'The screen under the left group head that distributes water over the grounds.'],
    ['shower-screen-right', 'Right shower screen', 'The screen under the right group head that distributes water over the grounds.'],
  ],
  'Steam and water': [
    ['steam-wand-left', 'Left steam wand', 'The left pivoting tube used to steam milk.'],
    ['steam-wand-right', 'Right steam wand', 'The right pivoting tube used to steam milk.'],
    ['steam-knob-left', 'Left steam knob', 'The control for the left steam wand.'],
    ['steam-knob-right', 'Right steam knob', 'The control for the right steam wand.'],
    ['water-knob', 'Hot water knob', 'The control for the center hot-water spout.'],
    ['hot-water-spout', 'Hot water spout', 'The center outlet for dispensing hot water.'],
  ],
  'Controls and gauges': [
    ['pressure-gauge-left', 'Left pressure gauge', 'The round pressure indicator to the left of center.'],
    ['pressure-gauge-right', 'Right pressure gauge', 'The round pressure indicator to the right of center.'],
    ['control-panel-left', 'Left brew control panel', 'The mounting plate around the left brew buttons.'],
    ['control-panel-right', 'Right brew control panel', 'The mounting plate around the right brew buttons.'],
    ...['left', 'right'].flatMap((side) =>
      ['lower-left', 'upper-left', 'lower-right', 'upper-right'].map((position, index) => [
        `brew-button-${side}-${index + 1}`,
        `${side === 'left' ? 'Left' : 'Right'} panel, ${position} button`,
        `The ${position} brew button on the ${side} control panel.`,
      ]),
    ),
  ],
  'Body and tray': [
    ['drip-grate', 'Drip tray grate', 'The removable slatted surface that supports the cups.'],
    ['drip-tray', 'Drip tray', 'The tray below the grate that catches spills and runoff.'],
    ['cup-rail', 'Cup warmer rail', 'The raised rail around the top cup-warming surface.'],
    ['top-panel', 'Top panel', 'The top cover and cup-warming surface.'],
    ['front-panel', 'Front panel', 'The body panels behind the controls and brew assemblies.'],
    ['rear-panel', 'Rear panel', 'The back cover of the machine.'],
    ['side-panel-left', 'Left side panel', 'The left exterior cover.'],
    ['side-panel-right', 'Right side panel', 'The right exterior cover.'],
    ['chassis', 'Bottom chassis', 'The base and underside of the machine housing.'],
    ['foot-front-left', 'Front left foot', 'The support under the front left corner.'],
    ['foot-front-right', 'Front right foot', 'The support under the front right corner.'],
    ['foot-rear-left', 'Rear left foot', 'The support under the rear left corner.'],
    ['foot-rear-right', 'Rear right foot', 'The support under the rear right corner.'],
  ],
};

export const PARTS = Object.entries(componentGroups).flatMap(([group, components]) =>
  components.map(([id, name, description, offerKey]) => ({
    id, name, group, description, offerKey, inside: group === 'Inside the machine',
  })),
);

export const PART_BY_ID = Object.fromEntries(PARTS.map((part) => [part.id, part]));
