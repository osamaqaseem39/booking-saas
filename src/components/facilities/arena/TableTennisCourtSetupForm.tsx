import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createTableTennisCourt,
  getTableTennisCourt,
  listTimeSlotTemplates,
  updateTableTennisCourt,
  type CreateTableTennisCourtBody,
  type TableTennisCourtDetail,
  type TableTennisCourtMeta,
} from '../../../api/saasClient';
import type { BusinessLocationRow } from '../../../types/domain';

function parseNum(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntOpt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function strFromApi(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function buildMeta(p: {
  roomType: '' | 'indoor' | 'covered' | 'outdoor';
  playSurface: string;
  tableModel: string;
  playAreaLengthM: string;
  playAreaWidthM: string;
  ceilingHeightM: string;
  lighting: string;
  ballRental: boolean;
  racketRental: boolean;
  coaching: boolean;
  amenSeating: boolean;
  amenParking: boolean;
  amenWater: boolean;
  peakWeekdayEvening: string;
  peakWeekend: string;
  membershipPrice: string;
  gameRules: string;
  cancellationPolicy: string;
}): TableTennisCourtMeta | undefined {
  const m: TableTennisCourtMeta = {};
  if (p.roomType) m.roomType = p.roomType;
  if (p.playSurface.trim()) m.playSurface = p.playSurface.trim();
  if (p.tableModel.trim()) m.tableModel = p.tableModel.trim();
  const len = parseNum(p.playAreaLengthM);
  const wid = parseNum(p.playAreaWidthM);
  const ch = parseNum(p.ceilingHeightM);
  if (len !== undefined) m.playAreaLengthM = len;
  if (wid !== undefined) m.playAreaWidthM = wid;
  if (ch !== undefined) m.ceilingHeightM = ch;
  if (p.lighting.trim()) m.lighting = p.lighting.trim();
  if (p.ballRental) m.ballRental = true;
  if (p.racketRental) m.racketRental = true;
  if (p.coaching) m.coaching = true;
  if (p.amenSeating) m.amenSeating = true;
  if (p.amenParking) m.amenParking = true;
  if (p.amenWater) m.amenWater = true;
  const pw = parseNum(p.peakWeekdayEvening);
  const we = parseNum(p.peakWeekend);
  if (pw !== undefined) m.peakWeekdayEvening = pw;
  if (we !== undefined) m.peakWeekend = we;
  const mem = parseNum(p.membershipPrice);
  if (mem !== undefined) m.membershipPrice = mem;
  if (p.gameRules.trim()) m.gameRules = p.gameRules.trim();
  if (p.cancellationPolicy.trim())
    m.cancellationPolicy = p.cancellationPolicy.trim();
  if (Object.keys(m).length === 0) return undefined;
  return m;
}

type Props = {
  locationId: string;
  locations: BusinessLocationRow[];
  existingCourtId?: string;
  onSuccess: () => void;
};

export function TableTennisCourtSetupForm({
  locationId,
  locations,
  existingCourtId,
  onSuccess,
}: Props) {
  const isUpdate = Boolean(existingCourtId);
  const [name, setName] = useState('');
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [description, setDescription] = useState('');
  const [imageLines, setImageLines] = useState('');
  const [pricePerSlot, setPricePerSlot] = useState('');
  const [courtStatus, setCourtStatus] = useState<
    'active' | 'maintenance' | 'draft'
  >('active');
  const [isActive, setIsActive] = useState(true);
  const [timeSlotTemplateId, setTimeSlotTemplateId] = useState('');
  const [slotDuration, setSlotDuration] = useState<'60' | ''>('60');
  const [bufferMinutes, setBufferMinutes] = useState('');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>(
    [],
  );

  const [roomType, setRoomType] = useState<'' | 'indoor' | 'covered' | 'outdoor'>(
    'indoor',
  );
  const [playSurface, setPlaySurface] = useState('');
  const [tableModel, setTableModel] = useState('');
  const [playAreaLengthM, setPlayAreaLengthM] = useState('');
  const [playAreaWidthM, setPlayAreaWidthM] = useState('');
  const [ceilingHeightM, setCeilingHeightM] = useState('');
  const [lighting, setLighting] = useState('');

  const [ballRental, setBallRental] = useState(false);
  const [racketRental, setRacketRental] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [amenSeating, setAmenSeating] = useState(false);
  const [amenParking, setAmenParking] = useState(false);
  const [amenWater, setAmenWater] = useState(false);

  const [peakWeekdayEvening, setPeakWeekdayEvening] = useState('');
  const [peakWeekend, setPeakWeekend] = useState('');
  const [membershipPrice, setMembershipPrice] = useState('');

  const [gameRules, setGameRules] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(!!existingCourtId);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  const locationOptions = useMemo(
    () =>
      [...locations].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [locations],
  );

  useEffect(() => {
    void (async () => {
      try {
        const list = await listTimeSlotTemplates();
        setTemplates((list || []).map((t) => ({ id: t.id, name: t.name })));
      } catch {
        setTemplates([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isUpdate || !existingCourtId) {
      setLoadingDetail(false);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setInitialLoadError(null);
    void (async () => {
      try {
        const c: TableTennisCourtDetail = await getTableTennisCourt(
          existingCourtId,
        );
        if (cancelled) return;
        setName(c.name || '');
        setArenaLocationId(c.businessLocationId ?? locationId);
        setDescription(c.description || '');
        setImageLines(
          Array.isArray(c.imageUrls) ? c.imageUrls.join('\n') : '',
        );
        setPricePerSlot(
          c.pricePerSlot != null && String(c.pricePerSlot).trim() !== ''
            ? String(c.pricePerSlot)
            : '',
        );
        if (c.courtStatus) setCourtStatus(c.courtStatus);
        if (c.isActive !== undefined) setIsActive(c.isActive);
        if (c.timeSlotTemplateId) setTimeSlotTemplateId(c.timeSlotTemplateId);
        if (c.slotDurationMinutes === 60) setSlotDuration('60');
        setBufferMinutes(strFromApi(c.bufferBetweenSlotsMinutes));

        const meta = (c.meta || {}) as TableTennisCourtMeta;
        const rt = meta.roomType;
        setRoomType(
          rt === 'indoor' || rt === 'covered' || rt === 'outdoor' ? rt : 'indoor',
        );
        setPlaySurface(strFromApi(meta.playSurface));
        setTableModel(strFromApi(meta.tableModel));
        setPlayAreaLengthM(strFromApi(meta.playAreaLengthM));
        setPlayAreaWidthM(strFromApi(meta.playAreaWidthM));
        setCeilingHeightM(strFromApi(meta.ceilingHeightM));
        setLighting(strFromApi(meta.lighting));
        setBallRental(!!meta.ballRental);
        setRacketRental(!!meta.racketRental);
        setCoaching(!!meta.coaching);
        setAmenSeating(!!meta.amenSeating);
        setAmenParking(!!meta.amenParking);
        setAmenWater(!!meta.amenWater);
        setPeakWeekdayEvening(strFromApi(meta.peakWeekdayEvening));
        setPeakWeekend(strFromApi(meta.peakWeekend));
        setMembershipPrice(strFromApi(meta.membershipPrice));
        setGameRules(strFromApi(meta.gameRules));
        setCancellationPolicy(strFromApi(meta.cancellationPolicy));
      } catch (e) {
        if (!cancelled) {
          setInitialLoadError(
            e instanceof Error ? e.message : 'Failed to load table',
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingCourtId, isUpdate, locationId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const effectiveLocationId = existingCourtId ? arenaLocationId : locationId;
    if (!effectiveLocationId?.trim() || !name.trim()) return;
    setErr(null);
    setSaving(true);
    try {
      const imageUrls = imageLines
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
      const meta = buildMeta({
        roomType,
        playSurface,
        tableModel,
        playAreaLengthM,
        playAreaWidthM,
        ceilingHeightM,
        lighting,
        ballRental,
        racketRental,
        coaching,
        amenSeating,
        amenParking,
        amenWater,
        peakWeekdayEvening,
        peakWeekend,
        membershipPrice,
        gameRules,
        cancellationPolicy,
      });
      const body: CreateTableTennisCourtBody = {
        businessLocationId: effectiveLocationId,
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        pricePerSlot: parseNum(pricePerSlot),
        courtStatus,
        isActive,
        slotDurationMinutes: slotDuration === '60' ? 60 : undefined,
        bufferBetweenSlotsMinutes: parseIntOpt(bufferMinutes),
        timeSlotTemplateId: timeSlotTemplateId.trim() || null,
        meta: meta || undefined,
      };
      if (isUpdate && existingCourtId) {
        const { businessLocationId: _bl, ...patch } = body;
        await updateTableTennisCourt(existingCourtId, {
          ...patch,
          meta: meta ?? null,
        });
      } else {
        await createTableTennisCourt(body);
      }
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (initialLoadError) {
    return <div className="err-banner">{initialLoadError}</div>;
  }
  if (loadingDetail && existingCourtId) {
    return <div className="empty-state">Loading table…</div>;
  }

  return (
    <div className="turf-setup-form-wrap">
      <form
        className="form-grid turf-setup-form"
        onSubmit={(e) => void onSubmit(e)}
      >
        <p className="muted" style={{ marginBottom: 0 }}>
          <Link to="/app/Facilities" className="link-muted">
            ← Back to facilities
          </Link>
        </p>
        {err && <div className="err-banner turf-setup-form-error">{err}</div>}

        <div className="turf-setup-card">
          <h4>1. Basic information</h4>
          <div className="form-grid">
            <div>
              <label>Table name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={160}
                placeholder="e.g. Table 1 — Competition"
              />
            </div>
            <div>
              <label>Location</label>
              <select
                value={arenaLocationId}
                onChange={(e) => setArenaLocationId(e.target.value)}
                disabled={!!existingCourtId}
                title={
                  existingCourtId
                    ? 'Location cannot be changed for an existing table.'
                    : undefined
                }
              >
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select
                value={courtStatus}
                onChange={(e) => {
                  const v = e.target.value as typeof courtStatus;
                  setCourtStatus(v);
                  if (v === 'draft') setIsActive(false);
                }}
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="draft">Draft (not bookable)</option>
              </select>
            </div>
            <div>
              <label>Description (optional)</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What players see in listings — surface, level, or notes"
              />
            </div>
            <div>
              <label className="turf-setup-inline">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Accepting bookings (active listing)
              </label>
            </div>
            <div>
              <label>Image URLs (one per line)</label>
              <textarea
                rows={3}
                value={imageLines}
                onChange={(e) => setImageLines(e.target.value)}
                placeholder="https://…"
              />
              <p
                className="muted"
                style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}
              >
                Shown in apps when you connect gallery / listings to these
                links.
              </p>
            </div>
          </div>
        </div>

        <div className="turf-setup-card">
          <h4>2. Play area &amp; table</h4>
          <p
            className="muted"
            style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}
          >
            Room type and dimensions help staff and support match the physical
            space. Table model is optional.
          </p>
          <div className="form-grid">
            <div>
              <label>Room / hall type</label>
              <select
                value={roomType}
                onChange={(e) =>
                  setRoomType(
                    (e.target.value || 'indoor') as typeof roomType,
                  )
                }
              >
                <option value="indoor">Indoor</option>
                <option value="covered">Covered outdoor</option>
                <option value="outdoor">Open outdoor</option>
              </select>
            </div>
            <div>
              <label>Play surface (optional)</label>
              <input
                value={playSurface}
                onChange={(e) => setPlaySurface(e.target.value)}
                placeholder="e.g. Wood sprung floor, PVC sport tile"
              />
            </div>
            <div>
              <label>Table model (optional)</label>
              <input
                value={tableModel}
                onChange={(e) => setTableModel(e.target.value)}
                placeholder="e.g. ITTF approved — brand / model"
              />
            </div>
            <div className="form-row-2">
              <div>
                <label>Play area length (m)</label>
                <input
                  inputMode="decimal"
                  value={playAreaLengthM}
                  onChange={(e) => setPlayAreaLengthM(e.target.value)}
                  placeholder="e.g. 7"
                />
              </div>
              <div>
                <label>Play area width (m)</label>
                <input
                  inputMode="decimal"
                  value={playAreaWidthM}
                  onChange={(e) => setPlayAreaWidthM(e.target.value)}
                  placeholder="e.g. 4"
                />
              </div>
            </div>
            <div>
              <label>Ceiling height (m, optional)</label>
              <input
                inputMode="decimal"
                value={ceilingHeightM}
                onChange={(e) => setCeilingHeightM(e.target.value)}
                placeholder="Clear height above table"
              />
            </div>
            <div>
              <label>Lighting (optional)</label>
              <input
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                placeholder="e.g. 500+ lux, LED, no strobe"
              />
            </div>
          </div>
        </div>

        <div className="turf-setup-card">
          <h4>3. Pricing &amp; schedule</h4>
          <p
            className="muted"
            style={{ marginBottom: '0.65rem', fontSize: '0.85rem' }}
          >
            <strong>Base rate</strong> is per full hour. Shorter add-ons in the
            venue (e.g. 30 min) are billed at <strong>half</strong> the hourly
            rate by default. Extensions while playing are limited by the next
            booking — the system will only allow free time.
          </p>
          <div
            style={{
              fontSize: '0.82rem',
              marginBottom: '0.75rem',
              padding: '0.65rem 0.75rem',
              borderRadius: 'var(--radius, 8px)',
              background: 'var(--surface2, rgba(0,0,0,0.04))',
              border: '1px solid var(--border)',
            }}
          >
            <strong>Discounts</strong> are not stored on this table. Apply
            discounts at <strong>checkout</strong> (walk-in or app) as a
            separate line, so reports stay clear.
          </div>
          <div className="form-grid">
            <div>
              <label>Base price per hour (PKR)</label>
              <input
                type="text"
                inputMode="decimal"
                value={pricePerSlot}
                onChange={(e) => setPricePerSlot(e.target.value)}
                placeholder="e.g. 1500"
              />
            </div>
            <div className="form-row-2">
              <div>
                <label>Peak: weekday evening (PKR/h, optional)</label>
                <input
                  inputMode="decimal"
                  value={peakWeekdayEvening}
                  onChange={(e) => setPeakWeekdayEvening(e.target.value)}
                  placeholder="Override for Mon–Fri peak"
                />
              </div>
              <div>
                <label>Peak: weekend (PKR/h, optional)</label>
                <input
                  inputMode="decimal"
                  value={peakWeekend}
                  onChange={(e) => setPeakWeekend(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label>Membership / package hint (PKR, optional)</label>
              <input
                inputMode="decimal"
                value={membershipPrice}
                onChange={(e) => setMembershipPrice(e.target.value)}
                placeholder="Reference price for display — not auto-charged"
              />
            </div>
            <div>
              <label>Default slot length</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(e.target.value as '60' | '')}
              >
                <option value="60">60 minutes (app grid default)</option>
              </select>
            </div>
            <div>
              <label>Buffer between sessions (minutes, optional)</label>
              <input
                inputMode="numeric"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label>Time slot template (optional)</label>
              <select
                value={timeSlotTemplateId}
                onChange={(e) => setTimeSlotTemplateId(e.target.value)}
              >
                <option value="">— None: generate hourly grid —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p
                className="muted"
                style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}
              >
                When set, open hours follow this template. Walk-in can still
                use manual start/end with minimum 30 minutes where your policy
                allows.
              </p>
            </div>
          </div>
        </div>

        <div className="turf-setup-card">
          <h4>4. Extras &amp; amenities</h4>
          <div className="turf-setup-checkrow turf-setup-checkrow--wrap">
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={ballRental}
                onChange={(e) => setBallRental(e.target.checked)}
              />
              Ball rental
            </label>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={racketRental}
                onChange={(e) => setRacketRental(e.target.checked)}
              />
              Racket / bat rental
            </label>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={coaching}
                onChange={(e) => setCoaching(e.target.checked)}
              />
              Coaching available
            </label>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={amenSeating}
                onChange={(e) => setAmenSeating(e.target.checked)}
              />
              Seating
            </label>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={amenParking}
                onChange={(e) => setAmenParking(e.target.checked)}
              />
              Parking
            </label>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={amenWater}
                onChange={(e) => setAmenWater(e.target.checked)}
              />
              Drinking water
            </label>
          </div>
        </div>

        <div className="turf-setup-card">
          <h4>5. Rules &amp; policies</h4>
          <div className="form-grid">
            <div>
              <label>Game / house rules (optional)</label>
              <textarea
                rows={3}
                value={gameRules}
                onChange={(e) => setGameRules(e.target.value)}
                placeholder="Singles/doubles, shoes, no food on court…"
              />
            </div>
            <div>
              <label>Cancellation policy (optional)</label>
              <textarea
                rows={2}
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                placeholder="How late can players cancel or reschedule"
              />
            </div>
          </div>
        </div>

        <div className="turf-setup-form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isUpdate ? 'Save changes' : 'Create table'}
          </button>
        </div>
      </form>
    </div>
  );
}
