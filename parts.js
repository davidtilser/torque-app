const componentGroups = {
  'Inside the machine': [
    ['water-tank', 'Water tank', 'The removable 2 L reservoir under the rear lid.', 5, ['38120334']],
    ['boiler', 'Boiler', 'The Silvia uses one insulated boiler for brewing and steam.', 9, ['10705636', '10705637', '69000409']],
    ['water-pump', 'Water pump', 'Draws water from the reservoir. The catalog lists two voltage and frequency variants.', 9, ['34011023', '34011026']],
    ['solenoid-valve', 'Three-way valve', 'Routes brew water and drains pressure from the group.', 7, ['34040039', '34040053']],
    ['expansion-valve', 'Expansion valve', 'Part of the pressure regulation circuit between the pump and boiler.', 9, ['10060406']],
    ['brew-thermostat', 'Brew thermostat', 'Senses boiler temperature during brewing.', 9, ['34200296']],
    ['steam-thermostat', 'Steam thermostat', 'Senses boiler temperature during steaming.', 9, ['34200295']],
    ['inlet-hose', 'Reservoir hose', 'Carries water from the tank to the pump.', 9, ['38228002']],
    ['heating-element', 'Heating element', 'The replaceable heater is fitted within the boiler assembly.', 9, ['10705638', '10705639']],
    ['steam-valve', 'Steam valve', 'The valve behind the knob controls flow to the steam wand.', 9, ['10060119', '10705169']],
  ],
  Brewing: [
    ['brew-head', 'Group head', 'The assembly where the single portafilter locks in.', 7, ['20103022D']],
    ['seal', 'Group head gasket', 'Seals the joint between the brew group and portafilter.', 7, ['36301030']],
    ['shower-screen', 'Shower screen', 'Distributes water over the grounds.', 7, ['40200005']],
    ['portafilter', 'Portafilter', 'The removable handle and filter holder.', 7, ['10070108R']],
  ],
  'Steam and controls': [
    ['steam-wand', 'Steam wand', 'The pivoting tube for steaming milk and dispensing hot water.', 9, ['10049063']],
    ['steam-knob', 'Steam knob', 'Opens and closes the steam valve.', 5, ['10060190']],
    ['power-switch', 'Power switch', 'Turns the machine on or off.', 5, ['34030144']],
    ['brew-switch', 'Brew switch', 'Starts and stops water flow through the group.', 5, ['34030047']],
    ['water-switch', 'Hot-water switch', 'Switches on the hot-water function.', 5, ['34030029']],
    ['steam-switch', 'Steam switch', 'Switches the boiler to steam mode.', 5, ['34030038']],
  ],
  'Housing and tray': [
    ['tank-lid', 'Reservoir lid', 'The black lid over the removable water tank.', 5, ['38123011']],
    ['top-panel', 'Top panel', 'The steel top cover and cup-warming surface.', 5, ['32330363']],
    ['side-panel-left', 'Left housing panel', 'The left side of the Silvia body.', 5, ['32330362']],
    ['side-panel-right', 'Right housing panel', 'The right side of the Silvia body.', 5, ['32330362']],
    ['rear-panel', 'Rear housing panel', 'The rear face of the Silvia body.', 5, ['32330362']],
    ['front-panel', 'Front control panel', 'The upper steel fascia around the controls.', 5, ['32331989']],
    ['lower-panel', 'Lower front panel', 'The back wall of the cup area below the group.', 5, ['32330370']],
    ['chassis', 'Chassis', 'The structural frame beneath the housing.', 5, ['10880188']],
    ['drip-grate', 'Cup grate', 'The removable steel surface that supports a cup.', 5, ['32330369']],
    ['drip-tray', 'Drip tray', 'Catches spills and runoff under the cup grate.', 5, ['32330365']],
    ...['front-left', 'front-right', 'rear-left', 'rear-right'].map((corner) =>
      [`foot-${corner}`, `${corner.replace('-', ' ')} foot`, 'Rubber support under the chassis.', 5, ['36310008']],
    ),
  ],
};

export const PARTS = Object.entries(componentGroups).flatMap(([group, components]) =>
  components.map(([id, name, description, page, partNumbers]) => ({
    id, name: name[0].toUpperCase() + name.slice(1), group, description, page, partNumbers,
    inside: group === 'Inside the machine',
  })),
);

export const PART_BY_ID = Object.fromEntries(PARTS.map((part) => [part.id, part]));
export const REMOVABLE_PARTS = new Set(['tank-lid', 'top-panel', 'side-panel-left', 'lower-panel']);

export const VARIANT_NAMES = {
  '10060119': 'Steam valve',
  '10705169': 'Steam wand and valve assembly',
  '10705636': 'Boiler and heater kit · 110–120 V',
  '10705637': 'Boiler and heater kit · 220–240 V',
  '10705638': 'Heating element and gasket · 110–120 V',
  '10705639': 'Heating element and gasket · 220–240 V',
  '34040039': 'Three-way valve · 110 V',
  '34040053': 'Three-way valve · 220–240 V',
  '69000409': 'Boiler insulation',
};
