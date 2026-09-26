import { render, screen, within, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import App from '../App';
import { openStore } from '../storage/db';
import { BACKUP_APP_ID } from '../storage/backup';

vi.mock('../storage/backup', async (orig) => {
  const mod = await orig<typeof import('../storage/backup')>();
  return { ...mod, saveFile: vi.fn(async () => 'downloaded' as const) };
});
import { saveFile } from '../storage/backup';

let dbName = '';
let nowMs = 0;
const clock = () => new Date(nowMs);
const factory = () => openStore(dbName);

function setup() {
  return render(<App storeFactory={factory} clock={clock} />);
}
const tab = (name: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}$`) }));
async function recordYes() {
  fireEvent.click(await screen.findByRole('button', { name: /YES, I DID THE THING|Actually, I did the thing/ }));
  await screen.findByText(/Today's successful deployments: \d/);
  fireEvent.click(document.querySelector('.celebrate')!);
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  dbName = `app-${Math.random()}`;
  nowMs = new Date(2026, 8, 25, 8, 42).getTime();
});
afterEach(() => cleanup());

describe('Today', () => {
  it('shows the empty first-run state', async () => {
    setup();
    expect(await screen.findByText(/Did you/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /YES, I DID THE THING/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No\. Send help\./ })).toBeInTheDocument();
    expect(screen.getByText('Awaiting First Deployment')).toBeInTheDocument();
  });

  it('records the first poop with a celebration and switches to mission accomplished', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /YES, I DID THE THING/ }));
    expect(await screen.findByText("Today's successful deployments: 1")).toBeInTheDocument();
    expect(screen.getByText('Launch Day')).toBeInTheDocument(); // achievement unlocked in the celebration
    fireEvent.click(document.querySelector('.celebrate')!);
    expect(await screen.findByText('Mission accomplished.')).toBeInTheDocument();
    expect(screen.getByText('8:42 AM')).toBeInTheDocument();
  });

  it('records multiple poops on the same day, ignoring an accidental double tap', async () => {
    setup();
    await recordYes();
    const again = await screen.findByRole('button', { name: /Record another/ });
    await waitFor(() => expect(again).toBeEnabled());
    fireEvent.click(again); // same instant → treated as an accidental double tap
    await waitFor(() => expect(again).toBeEnabled());
    nowMs += 3 * 3600_000;
    await act(async () => {});
    fireEvent.click(again);
    expect(await screen.findByText("Today's successful deployments: 2")).toBeInTheDocument();
    const store = await openStore(dbName);
    expect(await store.getEvents()).toHaveLength(2);
  });

  it('"No. Send help." changes the message but never creates an event', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /No\. Send help\./ }));
    expect((await screen.findAllByText(/Standby mode/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Actually, I did the thing/ })).toBeInTheDocument();
    const store = await openStore(dbName);
    expect(await store.getEvents()).toHaveLength(0);
  });

  it('persists history across app restarts', async () => {
    const first = setup();
    await recordYes();
    first.unmount();
    setup();
    expect(await screen.findByText('Mission accomplished.')).toBeInTheDocument();
  });
});

describe('Calendar', () => {
  it('navigates months and shows events with multiples', async () => {
    const store = await openStore(dbName);
    await store.mergeEvents([
      { id: 'a', ts: new Date(2026, 8, 20, 8).getTime(), createdAt: 0, source: 'tap' },
      { id: 'b', ts: new Date(2026, 8, 20, 19).getTime(), createdAt: 0, source: 'tap' },
      { id: 'c', ts: new Date(2026, 7, 3, 9).getTime(), createdAt: 0, source: 'tap' },
    ]);
    setup();
    await screen.findByText(/Did you/);
    tab('Calendar');
    expect(screen.getByRole('heading', { name: /September\s+2026/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Sep 20, 2026: 2 movements/ })).toHaveTextContent('×2');
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: /August\s+2026/ })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /Aug 3, 2026: 1 movement/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: /October\s+2026/ })).toBeInTheDocument();
    // far past months keep working
    for (let i = 0; i < 30; i++) fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: /April\s+2024/ })).toBeInTheDocument();
  });

  it('opens a day, shows exact times, and deletes an accidental event after confirmation', async () => {
    setup();
    await recordYes();
    tab('Calendar');
    fireEvent.click(screen.getByRole('gridcell', { name: /today: 1 movement/ }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('8:42 AM')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: /Delete the 8:42 AM movement/ }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep It' }));
    expect(screen.getByText('8:42 AM')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: /Delete the 8:42 AM movement/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete Movement' }));
    expect(await within(sheet).findByText('No movements recorded')).toBeInTheDocument();
    expect(within(sheet).queryByText('8:42 AM')).toBeNull();
  });

  it('adds a forgotten movement to a past day', async () => {
    setup();
    await screen.findByText(/Did you/);
    tab('Calendar');
    fireEvent.click(screen.getByRole('gridcell', { name: /Sep 10, 2026: no movements/ }));
    const sheet = await screen.findByRole('dialog');
    fireEvent.change(within(sheet).getByLabelText(/Add a movement/), { target: { value: '07:30' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add' }));
    expect(await within(sheet).findByText('7:30 AM')).toBeInTheDocument();
  });
});

describe('Intel, Archive and Awards', () => {
  it('shows the Intelligence Division briefing and the archive with classified entries', async () => {
    setup();
    await recordYes();
    tab('Intel');
    expect(screen.getAllByText('Bowel Intelligence Division').length).toBeGreaterThan(0);
    expect(screen.getByText("Today's Briefing")).toBeInTheDocument();
    expect(screen.getByText('Movement #1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Insight Archive/ }));
    expect(screen.getByRole('heading', { name: 'Insight Archive' })).toBeInTheDocument();
    expect(screen.getAllByText(/CLASSIFIED|\?\?\?/).length).toBeGreaterThan(0);
    expect(screen.getByText(/MORE/)).toBeInTheDocument();
  });

  it('shows unlocked and locked achievements', async () => {
    setup();
    await recordYes();
    tab('Awards');
    expect(screen.getByText('Launch Day')).toBeInTheDocument();
    expect(screen.getByLabelText('Launch Day: unlocked')).toBeInTheDocument();
    expect(screen.getByLabelText('Century Club: locked')).toBeInTheDocument();
  });
});

describe('Settings', () => {
  it('uses human language only', async () => {
    setup();
    await screen.findByText(/Did you/);
    tab('Settings');
    const text = document.querySelector('main')!.textContent!;
    for (const banned of ['JSON', 'Export', 'Import', 'Database', 'IndexedDB', 'localStorage', 'Schema', 'Migration']) {
      expect(text).not.toContain(banned);
    }
    expect(screen.getByText('Download My History')).toBeInTheDocument();
    expect(screen.getByText('Restore My History')).toBeInTheDocument();
  });

  it('Download My History saves a complete history file', async () => {
    setup();
    await recordYes();
    tab('Settings');
    fireEvent.click(screen.getByRole('button', { name: /Download My History/ }));
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    const [filename, text] = vi.mocked(saveFile).mock.calls.at(-1)!;
    expect(filename).toMatch(/^Indras-Poop-History-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(text).events).toHaveLength(1);
  });

  it('Restore My History adds a saved copy and celebrates', async () => {
    setup();
    await recordYes();
    tab('Settings');
    const file = new File([JSON.stringify({ app: BACKUP_APP_ID, formatVersion: 2, events: [{ id: 'r1', ts: new Date(2026, 5, 1, 9).getTime(), createdAt: 1, source: 'tap' }] })], 'Indras-Poop-History.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('restore-input'), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: /Add to My Existing History/ }));
    expect(await screen.findByText('HISTORICAL OPERATIONS RESTORED')).toBeInTheDocument();
    expect(screen.getByText(/Your poop empire has returned/)).toBeInTheDocument();
    expect(await (await openStore(dbName)).getEvents()).toHaveLength(2);
  });

  it('Replace requires confirmation', async () => {
    setup();
    await recordYes();
    tab('Settings');
    const file = new File([JSON.stringify({ app: BACKUP_APP_ID, formatVersion: 2, events: [] })], 'h.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('restore-input'), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: /Replace My Current History/ }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/can’t be undone/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Go Back' }));
    expect(await (await openStore(dbName)).getEvents()).toHaveLength(1);
  });

  it('rejects a malformed file without touching history', async () => {
    setup();
    await recordYes();
    tab('Settings');
    const file = new File(['this is not a history'], 'notes.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('restore-input'), { target: { files: [file] } });
    expect(await screen.findByText('We couldn’t use that file')).toBeInTheDocument();
    expect(await (await openStore(dbName)).getEvents()).toHaveLength(1);
  });

  it('Delete All History requires typing DELETE', async () => {
    setup();
    await recordYes();
    tab('Settings');
    fireEvent.click(screen.getByRole('button', { name: /Delete All History/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Continue' }));
    const final = await screen.findByRole('alertdialog');
    const go = within(final).getByRole('button', { name: 'Delete Everything' });
    expect(go).toBeDisabled();
    fireEvent.change(within(final).getByLabelText(/Type DELETE/), { target: { value: 'delete' } });
    expect(go).toBeEnabled();
    fireEvent.click(go);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    tab('Today');
    expect(await screen.findByText(/Did you/)).toBeInTheDocument();
  });
});
