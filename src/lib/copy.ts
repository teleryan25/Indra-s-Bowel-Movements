// Product copy. Straight-faced on purpose.

export const CELEBRATIONS = [
  'WE HAVE MOVEMENT.',
  'Successful deployment.',
  'Package delivered.',
  'Outbound logistics confirmed.',
  'Another victory for infrastructure.',
  'Excellent work, team.',
  'Operations reports success.',
  'Mission accomplished.',
  'Logistics remains undefeated.',
  'Delivery confirmed.',
  'The shipment has left the warehouse.',
  'Quarterly targets: advancing.',
  'Supply chain: flowing.',
  'Movement confirmed. Markets rally.',
  'The board is pleased.',
  'Throughput achieved.',
  'Signed, sealed, delivered.',
  'Transaction complete.',
  'Operational excellence, again.',
  'History has been made. Again.',
  'A textbook execution.',
  'Deployment successful. No rollback required.',
  'Cargo released on schedule.',
  'The eagle has landed.',
  'Clean handoff to logistics.',
  'Another flawless release.',
  'Stakeholders have been notified.',
  'Fulfillment center: fulfilled.',
  'Productivity: unmatched.',
  'Strategic movement executed.',
] as const;

export function pickCelebration(rand: () => number = Math.random): string {
  return CELEBRATIONS[Math.floor(rand() * CELEBRATIONS.length) % CELEBRATIONS.length];
}

export const NO_MESSAGES = [
  { title: 'Help is on the way.', body: 'Operations has been placed on standby. Hydration teams have been dispatched. This happens to the best logistics networks.' },
  { title: 'Standby mode engaged.', body: 'No deployment yet today. The Center remains fully staffed and patient. Nothing has been written to the permanent record.' },
  { title: 'Executive leadership has been notified.', body: 'They are remaining calm. You should too. Tomorrow is a new fiscal day.' },
  { title: 'Temporary supply chain pause.', body: 'Every great enterprise has quiet days. Water and a short walk have been approved by management.' },
];

export function pickNoMessage(seed: number) {
  return NO_MESSAGES[Math.abs(seed) % NO_MESSAGES.length];
}

export const STATUS_COPY = {
  operational: { label: 'Operational', tone: 'good' },
  standby: { label: 'Standby', tone: 'calm' },
  delayed: { label: 'Awaiting Deployment', tone: 'calm' },
  disrupted: { label: 'Supply Chain Pause', tone: 'warn' },
  awaiting: { label: 'Ready for Launch', tone: 'calm' },
} as const;
