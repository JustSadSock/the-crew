const events = [
  { name: 'Meteor Shower', effect: { hull: -10 } },
  { name: 'Oxygen Leak', effect: { oxygen: -10 } },
  { name: 'Crew Panic', effect: { morale: -10 } },
  { name: 'Cooling Failure', effect: { temperature: 10 } },
];

function randomEvent() {
  if (process.env.TEST_EVENT) {
    const fixed = events.find(e => e.name === process.env.TEST_EVENT);
    if (fixed) return fixed;
  }
  return events[Math.floor(Math.random() * events.length)];
}

module.exports = { events, randomEvent };
