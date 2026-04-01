export type BookingSportType = 'futsal' | 'cricket' | 'padel';
export type BookingItemStatus = 'reserved' | 'confirmed' | 'cancelled';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'jazzcash' | 'easypaisa';
export type CourtKind =
  | 'turf_court'
  | 'futsal_field'
  | 'padel_court'
  | 'cricket_indoor_court';

export interface BookingItemRow {
  id: string;
  courtKind: CourtKind;
  courtId: string;
  slotId?: string;
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
  status: BookingItemStatus;
}

export interface BookingRecord {
  bookingId: string;
  arenaId: string;
  userId: string;
  sportType: BookingSportType;
  bookingDate: string;
  items: BookingItemRow[];
  pricing: {
    subTotal: number;
    discount: number;
    tax: number;
    totalAmount: number;
  };
  payment: {
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    transactionId?: string;
    paidAt?: string;
  };
  bookingStatus: BookingStatus;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingPayload {
  userId: string;
  sportType: BookingSportType;
  bookingDate: string;
  items: Array<{
    courtKind: CourtKind;
    courtId: string;
    slotId?: string;
    startTime: string;
    endTime: string;
    price: number;
    currency?: string;
    status: BookingItemStatus;
  }>;
  pricing: {
    subTotal: number;
    discount: number;
    tax: number;
    totalAmount: number;
  };
  payment: {
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    transactionId?: string;
    paidAt?: string;
  };
  bookingStatus?: BookingStatus;
  notes?: string;
}

export interface UpdateBookingPayload {
  bookingStatus?: BookingStatus;
  notes?: string;
  cancellationReason?: string;
  payment?: {
    paymentStatus?: PaymentStatus;
    paymentMethod?: PaymentMethod;
    transactionId?: string;
    paidAt?: string;
  };
  itemStatuses?: Array<{ itemId: string; status: BookingItemStatus }>;
}

export interface IamUserRow {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  roles?: string[];
}

export interface CourtOption {
  kind: CourtKind;
  id: string;
  label: string;
  businessLocationId?: string | null;
}

export interface BookingAvailabilityRecord {
  date: string;
  startTime: string;
  endTime: string;
  sportType?: BookingSportType;
  availableCourts: Array<{
    kind: CourtKind;
    id: string;
    name: string;
  }>;
  bookedSlots: Array<{
    kind: CourtKind;
    courtId: string;
    startTime: string;
    endTime: string;
    bookingId: string;
    itemId: string;
    status: BookingItemStatus;
  }>;
}

export interface CourtSlotsRecord {
  date: string;
  kind: CourtKind;
  courtId: string;
  slots: Array<{
    startTime: string;
    endTime: string;
    bookingId: string;
    itemId: string;
    status: BookingItemStatus;
  }>;
}

export type CourtSlotGridSegment =
  | {
      startTime: string;
      endTime: string;
      state: 'free';
    }
  | {
      startTime: string;
      endTime: string;
      state: 'booked';
      bookingId: string;
      itemId: string;
      status: BookingItemStatus;
    };

export interface CourtSlotGridRecord {
  date: string;
  kind: CourtKind;
  courtId: string;
  segmentMinutes: 30;
  gridStartTime: string;
  gridEndTime: string;
  workingHoursApplied?: boolean;
  locationClosed?: boolean;
  availableOnly?: boolean;
  segments: CourtSlotGridSegment[];
}
