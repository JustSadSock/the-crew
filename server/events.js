const events = [
  { name: 'Meteor Shower', effect: { hull: -10 } },
  { name: 'Oxygen Leak', effect: { oxygen: -10 } },
  { name: 'Crew Panic', effect: { morale: -10 } },
  { name: 'Cooling Failure', effect: { temperature: 10 } },
];

function randomEvent() {
  return events[Math.floor(Math.random() * events.length)];
}

module.exports = { events, randomEvent };
