import type { Dispatch, SetStateAction } from 'react';
import type { BusinessLocationRow } from '../../types/domain';
import { TurfSetupButtonSelect } from './TurfSetupButtonSelect';
import type { GamingStationSharedFormState } from './sharedGamingStationFormState';

type Props = {
  shared: GamingStationSharedFormState;
  setShared: Dispatch<SetStateAction<GamingStationSharedFormState>>;
  locationOptions: BusinessLocationRow[];
  arenaLocationId: string;
  setArenaLocationId: (id: string) => void;
  existingStationId?: string;
};

const STATUS_OPTS = [
  { value: 'active' as const, label: 'Active' },
  { value: 'maintenance' as const, label: 'Maintenance' },
  { value: 'draft' as const, label: 'Draft' },
];

const SLOT_OPTS = [
  { value: '30' as const, label: '30 min' },
  { value: '60' as const, label: '60 min' },
  { value: '90' as const, label: '90 min' },
  { value: '' as const, label: 'Custom / TBD' },
];

export function GamingStationSharedSections({
  shared,
  setShared,
  locationOptions,
  arenaLocationId,
  setArenaLocationId,
  existingStationId,
}: Props) {
  const patch = (p: Partial<GamingStationSharedFormState>) =>
    setShared((prev) => ({ ...prev, ...p }));

  return (
    <>
      <div className="turf-setup-card">
        <h4>1. Basic information</h4>
        <div className="form-grid">
          <div>
            <label>Station name</label>
            <input
              value={shared.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
              maxLength={160}
              placeholder="e.g. PS5 booth 2"
            />
          </div>
          <div>
            <label>Location</label>
            <select
              value={arenaLocationId}
              onChange={(e) => setArenaLocationId(e.target.value)}
              disabled={!!existingStationId}
              title={
                existingStationId
                  ? 'Location cannot be changed for an existing station.'
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
          <TurfSetupButtonSelect
            label="Station status"
            value={shared.unitStatus}
            options={STATUS_OPTS}
            onChange={(unitStatus) => {
              patch({ unitStatus });
              if (unitStatus === 'draft') patch({ isActive: false });
            }}
          />
          <div>
            <label>Description (optional)</label>
            <textarea
              rows={2}
              value={shared.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Short public description"
            />
          </div>
          <div>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={shared.isActive}
                onChange={(e) => patch({ isActive: e.target.checked })}
              />
              Accepting bookings (active listing)
            </label>
          </div>
          <div>
            <label>Image URLs (one per line)</label>
            <textarea
              rows={3}
              value={shared.imageLines}
              onChange={(e) => patch({ imageLines: e.target.value })}
              placeholder="https://…"
            />
            <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Same pattern as arena courts — paste links until media upload is wired.
            </p>
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>2. Pricing</h4>
        <div className="form-grid">
          <div>
            <label>Price per slot</label>
            <input
              type="text"
              inputMode="decimal"
              value={shared.pricePerSlot}
              onChange={(e) => patch({ pricePerSlot: e.target.value })}
              placeholder="e.g. 500"
            />
          </div>
          <div className="form-row-2">
            <div>
              <label>Peak — weekday evening</label>
              <input
                type="text"
                inputMode="decimal"
                value={shared.peakWeekdayEvening}
                onChange={(e) => patch({ peakWeekdayEvening: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div>
              <label>Peak — weekend</label>
              <input
                type="text"
                inputMode="decimal"
                value={shared.peakWeekend}
                onChange={(e) => patch({ peakWeekend: e.target.value })}
                placeholder="optional"
              />
            </div>
          </div>
          <div>
            <label>Package / membership note</label>
            <input
              value={shared.bundleNote}
              onChange={(e) => patch({ bundleNote: e.target.value })}
              placeholder="e.g. 3h bundle, student rate…"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>3. Slot settings</h4>
        <div className="form-grid">
          <TurfSetupButtonSelect
            label="Default slot length"
            value={shared.slotDuration}
            options={SLOT_OPTS}
            onChange={(slotDuration) => patch({ slotDuration })}
          />
          <div>
            <label>Buffer between sessions (minutes)</label>
            <input
              type="text"
              inputMode="numeric"
              value={shared.bufferMinutes}
              onChange={(e) => patch({ bufferMinutes: e.target.value })}
              placeholder="e.g. 5"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>4. Amenities</h4>
        <div className="turf-setup-checkrow turf-setup-checkrow--wrap">
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenSnacksNearby}
              onChange={(e) => patch({ amenSnacksNearby: e.target.checked })}
            />
            Snacks / drinks nearby
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenExtraControllers}
              onChange={(e) => patch({ amenExtraControllers: e.target.checked })}
            />
            Extra controllers available
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenStreamingCapture}
              onChange={(e) => patch({ amenStreamingCapture: e.target.checked })}
            />
            Streaming / capture setup
          </label>
        </div>
      </div>
    </>
  );
}
