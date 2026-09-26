import { useRef, useState } from 'react';
import { useOps } from '../state/OpsContext';
import { backupFilename, buildBackup, parseBackup, readFileText, saveFile, serializeBackup, type BackupFile } from '../storage/backup';
import { fmtDayShort, dayKey } from '../lib/dates';
import { Confirm, Dialog, Sheet } from '../components/Overlay';
import { IconChevronRight, IconDownload, IconInfo, IconMotion, IconRestore, IconShield, IconSpark, IconTrash } from '../components/Icons';

type RestoreStep =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'choose'; backup: BackupFile }
  | { kind: 'confirm-replace'; backup: BackupFile }
  | { kind: 'done'; added: number; mode: 'add' | 'replace' };

export function SettingsScreen() {
  const { events, settings, updateSettings, getMetaSnapshot, restore, deleteEverything } = useOps();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<RestoreStep>({ kind: 'idle' });
  const [saved, setSaved] = useState<string | null>(null);
  const [info, setInfo] = useState<'about' | 'privacy' | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');

  const download = async () => {
    const text = serializeBackup(buildBackup(events, getMetaSnapshot()));
    const result = await saveFile(backupFilename(), text);
    if (result === 'shared') setSaved('Saved. Your poop empire is safe. (Tip: “Save to Files” keeps it somewhere easy to find.)');
    else if (result === 'downloaded') setSaved('Your history has been saved to your Downloads.');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await readFileText(f).catch(() => '');
    const r = parseBackup(text);
    if (fileRef.current) fileRef.current.value = '';
    if (!r.ok) setStep({ kind: 'error', message: r.reason });
    else setStep({ kind: 'choose', backup: r.backup });
  };

  const doRestore = async (b: BackupFile, mode: 'add' | 'replace') => {
    const added = await restore(b, mode);
    setStep({ kind: 'done', added, mode });
  };

  const span = (b: BackupFile) => {
    if (!b.events.length) return 'This saved copy is empty.';
    const first = dayKey(new Date(b.events[0].ts));
    const last = dayKey(new Date(b.events[b.events.length - 1].ts));
    return `It contains ${b.events.length} movement${b.events.length === 1 ? '' : 's'} from ${fmtDayShort(first)}${first.slice(0, 4) !== last.slice(0, 4) ? `, ${first.slice(0, 4)}` : ''} to ${fmtDayShort(last)}, ${last.slice(0, 4)}.`;
  };

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Simple controls for a very serious operation.</p>

      <div className="section-title"><h2>Your History</h2></div>
      <div className="list">
        <button className="row" onClick={download}>
          <span className="ico" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden="true"><IconDownload /></span>
          <span className="txt">
            <span className="t" style={{ display: 'block' }}>Download My History</span>
            <span className="d" style={{ display: 'block' }}>Keep your poop empire safe. Save a copy of your history to your phone in case you ever change phones or lose your app data.</span>
          </span>
        </button>
        <button className="row" onClick={() => fileRef.current?.click()}>
          <span className="ico" style={{ background: 'var(--good-soft)', color: 'var(--good)' }} aria-hidden="true"><IconRestore /></span>
          <span className="txt">
            <span className="t" style={{ display: 'block' }}>Restore My History</span>
            <span className="d" style={{ display: 'block' }}>Already have a saved copy? Choose it here and we’ll put everything back where it belongs.</span>
          </span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} data-testid="restore-input" />
      {saved && <p role="status" style={{ margin: '10px 6px 0', color: 'var(--good)', fontSize: 14, fontWeight: 600 }}>{saved}</p>}

      <div className="section-title"><h2>Experience</h2></div>
      <div className="list">
        <label className="row" style={{ cursor: 'pointer' }}>
          <span className="ico" aria-hidden="true"><IconSpark /></span>
          <span className="txt">
            <span className="t" style={{ display: 'block' }}>Celebrations</span>
            <span className="d" style={{ display: 'block' }}>Confetti and ceremony every time. Turn off for a quiet confirmation.</span>
          </span>
          <span className="switch">
            <input type="checkbox" role="switch" checked={settings.celebrations} onChange={(e) => updateSettings({ celebrations: e.target.checked })} aria-label="Celebrations" />
            <span className="track" />
            <span className="thumb" />
          </span>
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="ico" aria-hidden="true"><IconMotion /></span>
          <span className="txt">
            <span className="t" style={{ display: 'block' }}>Reduce Motion</span>
            <span className="d" style={{ display: 'block' }}>Calmer screens with fewer animations.</span>
          </span>
          <div className="segmented" role="group" aria-label="Reduce motion" style={{ width: '100%', marginTop: 4 }}>
            {(['system', 'on', 'off'] as const).map((v) => (
              <button key={v} aria-pressed={settings.reducedMotion === v} onClick={() => updateSettings({ reducedMotion: v })}>
                {v === 'system' ? 'Match iPhone' : v === 'on' ? 'On' : 'Off'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title"><h2>About</h2></div>
      <div className="list">
        <button className="row" onClick={() => setInfo('about')}>
          <span className="ico" aria-hidden="true"><IconInfo /></span>
          <span className="txt"><span className="t">About the Center</span></span>
          <span className="end" aria-hidden="true"><IconChevronRight /></span>
        </button>
        <button className="row" onClick={() => setInfo('privacy')}>
          <span className="ico" aria-hidden="true"><IconShield /></span>
          <span className="txt">
            <span className="t" style={{ display: 'block' }}>Privacy</span>
            <span className="d" style={{ display: 'block' }}>Your poop is your business.</span>
          </span>
          <span className="end" aria-hidden="true"><IconChevronRight /></span>
        </button>
      </div>

      <div className="section-title"><h2>Danger Zone</h2></div>
      <div className="list">
        <button className="row danger" onClick={() => setDeleteStep(1)}>
          <span className="ico" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }} aria-hidden="true"><IconTrash /></span>
          <span className="txt">
            <span className="t" style={{ display: 'block' }}>Delete All History</span>
            <span className="d" style={{ display: 'block' }}>Permanently erase every movement, finding and award from this phone.</span>
          </span>
        </button>
      </div>

      <p className="footer-note">
        Indra’s Bowel Operations Center™ · v1.0<br />
        Mission-critical digestive infrastructure.<br />
        Made with an unreasonable amount of love by Ryan. ❤︎
      </p>

      {/* ----- restore flow ----- */}
      {step.kind === 'error' && (
        <Dialog title="We couldn’t use that file" onClose={() => setStep({ kind: 'idle' })}>
          <p>{step.message}</p>
          <div className="actions">
            <button className="btn btn-block btn-primary" onClick={() => setStep({ kind: 'idle' })} data-autofocus>OK</button>
          </div>
        </Dialog>
      )}
      {step.kind === 'choose' && (
        <Sheet title="Restore My History" subtitle="We found your saved copy." onClose={() => setStep({ kind: 'idle' })}>
          <p style={{ marginTop: 0 }}>{span(step.backup)}</p>
          {events.length === 0 ? (
            <button className="btn btn-block btn-primary" onClick={() => doRestore(step.backup, 'replace')} data-autofocus>
              Restore My History
            </button>
          ) : (
            <>
              <button className="option" onClick={() => doRestore(step.backup, 'add')} data-autofocus>
                <span className="t">Add to My Existing History</span>
                <span className="d">Keeps everything already on this phone and adds anything from the saved copy that’s missing. Nothing gets counted twice.</span>
              </button>
              <button className="option danger" onClick={() => setStep({ kind: 'confirm-replace', backup: step.backup })}>
                <span className="t">Replace My Current History</span>
                <span className="d">Erases the {events.length} movement{events.length === 1 ? '' : 's'} on this phone right now and uses the saved copy instead.</span>
              </button>
            </>
          )}
        </Sheet>
      )}
      {step.kind === 'confirm-replace' && (
        <Confirm
          title="Replace your current history?"
          body={`The ${events.length} movement${events.length === 1 ? '' : 's'} currently on this phone will be erased and replaced with the saved copy. This can’t be undone.`}
          confirmLabel="Replace My History"
          cancelLabel="Go Back"
          danger
          onCancel={() => setStep({ kind: 'choose', backup: step.backup })}
          onConfirm={() => doRestore(step.backup, 'replace')}
        />
      )}
      {step.kind === 'done' && (
        <Dialog title="HISTORICAL OPERATIONS RESTORED" onClose={() => setStep({ kind: 'idle' })}>
          <div style={{ fontSize: 52, textAlign: 'center', margin: '4px 0 8px' }} aria-hidden="true">🏛️</div>
          <p><b>Your poop empire has returned.</b> {step.mode === 'add' ? (step.added ? `${step.added} movement${step.added === 1 ? '' : 's'} added to your history.` : 'Everything in that copy was already here. Nothing was doubled.') : `${step.added} movement${step.added === 1 ? '' : 's'} restored.`}</p>
          <div className="actions">
            <button className="btn btn-block btn-primary" onClick={() => setStep({ kind: 'idle' })} data-autofocus>Excellent</button>
          </div>
        </Dialog>
      )}

      {/* ----- delete everything ----- */}
      {deleteStep === 1 && (
        <Confirm
          title="Delete all history?"
          body="This permanently erases every movement, every discovered finding and every award on this phone. If you might want it back someday, tap “Download My History” first."
          confirmLabel="Continue"
          cancelLabel="Keep My History"
          danger
          onCancel={() => setDeleteStep(0)}
          onConfirm={() => { setTyped(''); setDeleteStep(2); }}
        />
      )}
      {deleteStep === 2 && (
        <Dialog title="Are you absolutely sure?" onClose={() => setDeleteStep(0)} role="alertdialog">
          <p>To confirm, type <b>DELETE</b> below.</p>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" aria-label="Type DELETE to confirm" data-autofocus style={{ marginBottom: 14 }} />
          <div className="actions">
            <button className="btn btn-block btn-danger" disabled={typed.trim().toUpperCase() !== 'DELETE'} onClick={async () => { await deleteEverything(); setDeleteStep(0); setSaved(null); }}>
              Delete Everything
            </button>
            <button className="btn btn-block btn-secondary" onClick={() => setDeleteStep(0)}>Cancel</button>
          </div>
        </Dialog>
      )}

      {info === 'about' && (
        <Sheet title="About the Center" onClose={() => setInfo(null)}>
          <div className="legal">
            <p><b>Indra’s Bowel Operations Center™</b> is mission-critical digestive infrastructure, built to answer one question with the full seriousness it has never deserved: did you poop today?</p>
            <p>Tap the button when it happens. The Center remembers, draws up the charts, hands out awards, and — through the Bowel Intelligence Division — slowly discovers 500 completely unnecessary things about your schedule.</p>
            <p>Some findings appear right away. Others take weeks, months, or very specific circumstances. A few have nothing to do with poop at all.</p>
            <p>This is not a medical app and never gives health advice. It only ever compares you with you.</p>
          </div>
        </Sheet>
      )}
      {info === 'privacy' && (
        <Sheet title="Your poop is your business." onClose={() => setInfo(null)}>
          <div className="legal">
            <p><b>Your history stays on this device. We don’t send it anywhere.</b></p>
            <p>There are no accounts, no ads, no tracking, and no analytics. Nothing about your movements is ever uploaded, shared, or seen by anyone — including Ryan, unless you hand him your phone.</p>
            <p>The only copy that ever leaves this phone is one you choose to save with “Download My History.”</p>
            <p>Because everything lives on this phone, deleting the app or clearing Safari’s website data can erase it. Download a copy every so often to keep your empire safe.</p>
          </div>
        </Sheet>
      )}
    </>
  );
}
