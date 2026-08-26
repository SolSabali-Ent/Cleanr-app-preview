export interface Job {
  id: number;
  client: string;
  address: string;
  date: string;
  time: string;
  price: number;
  status: 'available' | 'accepted' | 'in_progress' | 'completed';
}

export interface ProviderJobData {
  id: string;
  publicCode: string;
  status: 'assigned' | 'en_route' | 'arrived' | 'in_progress' | 'verification_pending' | 'completed' | 'cancelled';
  serviceDate: string;
  timeWindow: { start: string; end: string };
  address: { street: string; city: string; state: string; zip: string; lat?: number; lng?: number };
  customer: { id: string; firstName: string; lastNameInitial?: string; rating?: number };
  service: { id: string; type: string; name: string; division: string };
  homeDetails: { bedrooms: number; bathrooms: number; sqft?: number; notes?: string };
  extras: { code: string; label: string }[];
  estimatedDurationMinutes: number;
  estimatedEarnings: number;
  verification: {
    required: boolean;
    phase?: 'before' | 'after';
    status: 'not_required' | 'pending' | 'pass' | 'flagged';
  };
  canStart: boolean;
  canComplete: boolean;
}

