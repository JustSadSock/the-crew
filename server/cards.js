const decks = {
  Engineer: [
    { name: 'Repair Hull', description: 'Patch small breaches in the hull.', effect: { hull: 10 } },
    { name: 'Vent Plasma', description: 'Lower temperature by venting plasma.', effect: { temperature: -5 } },
    { name: 'Reinforce Bulkhead', description: 'Improve hull integrity slightly.', effect: { hull: 5 } },
  ],
  Psychologist: [
    { name: 'Motivational Speech', description: 'Raise crew morale.', effect: { morale: 10 } },
    { name: 'Calming Therapy', description: 'Reduce stress for a small morale gain.', effect: { morale: 5 } },
    { name: 'Harsh Critique', description: 'Morale drops a bit but reveals issues.', effect: { morale: -5 } },
  ],
  Navigator: [
    { name: 'Plot Safe Course', description: 'Avoid dangerous sectors.', effect: { temperature: -5 } },
    { name: 'Short Warp', description: 'Consume oxygen to jump forward.', effect: { oxygen: -5 } },
    { name: 'Sensor Sweep', description: 'Scan ahead for threats.', effect: { hull: 0 } },
  ],
  Operator: [
    { name: 'Scan Frequencies', description: 'Boost morale slightly.', effect: { morale: 5 } },
    { name: 'Override Alarms', description: 'Cool the ship but strain the hull.', effect: { temperature: -5, hull: -5 } },
    { name: 'Open Channels', description: 'Communication boost at oxygen cost.', effect: { oxygen: -5, morale: 5 } },
  ],
};

module.exports = { decks };
