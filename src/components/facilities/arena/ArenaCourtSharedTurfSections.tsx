import { Link } from 'react-router-dom';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { BusinessLocationRow } from '../../../types/domain';
import type { SharedArenaTurfFormState } from './sharedArenaTurfFormState';

type Props = {
  shared: SharedArenaTurfFormState;
  setShared: Dispatch<SetStateAction<SharedArenaTurfFormState>>;
  locationOptions: BusinessLocationRow[];
  arenaLocationId: string;
  setArenaLocationId: (id: string) => void;
  courtStatus: 'active' | 'maintenance' | 'draft';
  setCourtStatus: (v: 'active' | 'maintenance' | 'draft') => void;
  existingCourtId?: string;
  /** Labels for optional time-slot template dropdown (tenant-level). */
  timeSlotTemplateOptions?: { id: string; name: string }[];
  /** Futsal / cricket specific controls */
  gameSection: ReactNode;
  gameSectionTitle?: string;
};

export function ArenaCourtSharedTurfSections({
  shared,
  setShared,
  locationOptions,
  arenaLocationId,
  setArenaLocationId,
  courtStatus,
  setCourtStatus,
  existingCourtId,
  timeSlotTemplateOptions = [],
  gameSection,
  gameSectionTitle = '5. Game settings',
}: Props) {
  const patch = (p: Partial<SharedArenaTurfFormState>) =>
    setShared((prev) => ({ ...prev, ...p }));

  return (
    <>
      <div className="turf-setup-card">
        <h4>1. Basic information</h4>
        <div className="form-grid">
          <div>
            <label>Pitch name</label>
            <input
              value={shared.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
              maxLength={160}
            />
          </div>
          <div>
            <label>Location</label>
            <select
              value={arenaLocationId}
              onChange={(e) => setArenaLocationId(e.target.value)}
              disabled={!!existingCourtId}
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
              onChange={(e) =>
                setCourtStatus(
                  e.target.value as 'active' | 'maintenance' | 'draft',
                )
              }
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="draft">Draft (not bookable)</option>
            </select>
          </div>
          <div>
            <label>Image URLs (one per line)</label>
            <textarea
              rows={3}
              value={shared.imageLines}
              onChange={(e) => patch({ imageLines: e.target.value })}
              placeholder="https://…"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>2. Structure details</h4>
        <div className="form-grid">
          <div className="form-row-2">
            <div>
              <label>Ceiling height</label>
              <input
                type="text"
                inputMode="decimal"
                value={shared.ceilingHeightValue}
                onChange={(e) => patch({ ceilingHeightValue: e.target.value })}
                placeholder="e.g. 8"
              />
            </div>
            <div>
              <label>Unit</label>
              <select
                value={shared.ceilingHeightUnit}
                onChange={(e) =>
                  patch({
                    ceilingHeightUnit: e.target.value as 'ft' | 'm',
                  })
                }
              >
                <option value="m">m</option>
                <option value="ft">ft</option>
              </select>
            </div>
          </div>
          <div>
            <label>Covered type</label>
            <select
              value={shared.coveredType}
              onChange={(e) =>
                patch({
                  coveredType: e.target.value as SharedArenaTurfFormState['coveredType'],
                })
              }
            >
              <option value="">—</option>
              <option value="open">Open</option>
              <option value="semi_covered">Semi-covered</option>
              <option value="fully_indoor">Fully indoor</option>
            </select>
          </div>
          <div>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={shared.sideNetting}
                onChange={(e) => patch({ sideNetting: e.target.checked })}
              />
              Side netting
            </label>
          </div>
          <div>
            <label>Net height</label>
            <input
              value={shared.netHeight}
              onChange={(e) => patch({ netHeight: e.target.value })}
              maxLength={50}
            />
          </div>
          <div>
            <label>Boundary type</label>
            <select
              value={shared.boundaryType}
              onChange={(e) =>
                patch({
                  boundaryType: e.target.value as SharedArenaTurfFormState['boundaryType'],
                })
              }
            >
              <option value="">—</option>
              <option value="net">Net</option>
              <option value="wall">Wall</option>
            </select>
          </div>
          <div>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Ventilation
            </span>
            <div className="turf-setup-checkrow turf-setup-checkrow--wrap">
              <label className="turf-setup-inline">
                <input
                  type="checkbox"
                  checked={shared.ventNatural}
                  onChange={(e) => patch({ ventNatural: e.target.checked })}
                />
                Natural
              </label>
              <label className="turf-setup-inline">
                <input
                  type="checkbox"
                  checked={shared.ventFans}
                  onChange={(e) => patch({ ventFans: e.target.checked })}
                />
                Fans
              </label>
              <label className="turf-setup-inline">
                <input
                  type="checkbox"
                  checked={shared.ventAc}
                  onChange={(e) => patch({ ventAc: e.target.checked })}
                />
                AC
              </label>
            </div>
          </div>
          <div>
            <label>Lighting</label>
            <select
              value={shared.lighting}
              onChange={(e) =>
                patch({
                  lighting: e.target.value as SharedArenaTurfFormState['lighting'],
                })
              }
            >
              <option value="">—</option>
              <option value="led_floodlights">LED floodlights</option>
              <option value="mixed">Mixed</option>
              <option value="daylight">Daylight</option>
            </select>
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>3. Dimensions (meters)</h4>
        <div className="form-row-2">
          <div>
            <label>Length (m)</label>
            <input
              type="text"
              inputMode="decimal"
              value={shared.lengthM}
              onChange={(e) => patch({ lengthM: e.target.value })}
            />
          </div>
          <div>
            <label>Width (m)</label>
            <input
              type="text"
              inputMode="decimal"
              value={shared.widthM}
              onChange={(e) => patch({ widthM: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>4. Surface</h4>
        <div className="form-grid">
          <div>
            <label>Surface type</label>
            <select
              value={shared.surfaceType}
              onChange={(e) =>
                patch({
                  surfaceType: e.target.value as SharedArenaTurfFormState['surfaceType'],
                })
              }
            >
              <option value="">—</option>
              <option value="artificial_turf">Artificial turf</option>
              <option value="hard_surface">Hard surface</option>
            </select>
          </div>
          <div>
            <label>Turf / surface quality</label>
            <input
              value={shared.turfQuality}
              onChange={(e) => patch({ turfQuality: e.target.value })}
              maxLength={120}
            />
          </div>
          <div>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={shared.shockAbsorptionLayer}
                onChange={(e) =>
                  patch({ shockAbsorptionLayer: e.target.checked })
                }
              />
              Shock absorption layer
            </label>
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>{gameSectionTitle}</h4>
        {gameSection}
      </div>

      <div className="turf-setup-card">
        <h4>6. Pricing</h4>
        <div className="form-grid">
          <div>
            <label>Price per slot</label>
            <input
              type="text"
              inputMode="decimal"
              value={shared.pricePerSlot}
              onChange={(e) => patch({ pricePerSlot: e.target.value })}
            />
          </div>
          <div className="form-row-2">
            <div>
              <label>Peak — weekday evening</label>
              <input
                type="text"
                inputMode="decimal"
                value={shared.peakWeekdayEvening}
                onChange={(e) =>
                  patch({ peakWeekdayEvening: e.target.value })
                }
              />
            </div>
            <div>
              <label>Peak — weekend</label>
              <input
                type="text"
                inputMode="decimal"
                value={shared.peakWeekend}
                onChange={(e) => patch({ peakWeekend: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label>Membership / discount label</label>
            <input
              value={shared.discountLabel}
              onChange={(e) => patch({ discountLabel: e.target.value })}
              maxLength={120}
            />
          </div>
          <div className="form-row-2">
            <div>
              <label>Discount amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={shared.discountAmount}
                onChange={(e) => patch({ discountAmount: e.target.value })}
              />
            </div>
            <div>
              <label>Percent off</label>
              <input
                type="text"
                inputMode="decimal"
                value={shared.discountPercentOff}
                onChange={(e) => patch({ discountPercentOff: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>7. Slot timing (saved with this facility)</h4>
        <div className="form-grid">
          <div>
            <label>Time slot template</label>
            <select
              value={shared.timeSlotTemplateId}
              onChange={(e) => patch({ timeSlotTemplateId: e.target.value })}
            >
              <option value="">None (full day grid on time slots page)</option>
              {timeSlotTemplateOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
              Create named lists of half-hour starts on{' '}
              <Link to="/app/time-slots">Manage time slots</Link>, then pick one here so the
              grid focuses on those windows.
            </p>
          </div>
          <div>
            <label>Slot length</label>
            <select
              value={shared.slotDuration}
              onChange={(e) =>
                patch({
                  slotDuration: e.target.value as SharedArenaTurfFormState['slotDuration'],
                })
              }
            >
              <option value="">Default (server)</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
              <option value="120">120 minutes</option>
            </select>
          </div>
          <div>
            <label>Buffer between slots (minutes)</label>
            <input
              type="text"
              inputMode="numeric"
              value={shared.bufferMinutes}
              onChange={(e) => patch({ bufferMinutes: e.target.value })}
              placeholder="e.g. 0 or 15"
            />
          </div>
          <div>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={shared.allowParallelBooking}
                onChange={(e) =>
                  patch({ allowParallelBooking: e.target.checked })
                }
              />
              Allow parallel bookings on this pitch
            </label>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Day-by-day availability (generate slots, mark blocked) is managed
            per facility on the Daily slots screen.
          </p>
          <div>
            <Link to="/app/facility-slots" className="btn-ghost btn-compact">
              Open daily slots
            </Link>
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>8. Amenities</h4>
        <div className="turf-setup-checkrow turf-setup-checkrow--wrap">
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenChanging}
              onChange={(e) => patch({ amenChanging: e.target.checked })}
            />
            Changing room
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenWashroom}
              onChange={(e) => patch({ amenWashroom: e.target.checked })}
            />
            Washroom
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenParking}
              onChange={(e) => patch({ amenParking: e.target.checked })}
            />
            Parking
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenWater}
              onChange={(e) => patch({ amenWater: e.target.checked })}
            />
            Drinking water
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shared.amenSeating}
              onChange={(e) => patch({ amenSeating: e.target.checked })}
            />
            Seating area
          </label>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>9. Rules</h4>
        <div className="form-grid">
          <div>
            <label>Max players</label>
            <input
              type="text"
              inputMode="numeric"
              value={shared.maxPlayers}
              onChange={(e) => patch({ maxPlayers: e.target.value })}
            />
          </div>
          <div>
            <label>Safety / game rules</label>
            <textarea
              rows={3}
              value={shared.safetyInstructions}
              onChange={(e) => patch({ safetyInstructions: e.target.value })}
            />
          </div>
          <div>
            <label>Cancellation policy</label>
            <textarea
              rows={3}
              value={shared.cancellationPolicy}
              onChange={(e) => patch({ cancellationPolicy: e.target.value })}
            />
          </div>
        </div>
      </div>
    </>
  );
}

