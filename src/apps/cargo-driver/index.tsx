import { useState } from 'react';
import {
  Truck, MapPin, Navigation, Star, DollarSign, Trophy,
  Clock, CheckCircle2, CircleDot, AlertTriangle, Phone,
  Play, Flag, Package, ChevronRight, User,
  Gift, TrendingUp, Calendar, AlertCircle, ScanLine,
  X, CheckCircle, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type TripStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type CheckpointStatus = 'NOT_REACHED' | 'REACHED';
type IncidentType = 'ACCIDENT' | 'BREAKDOWN' | 'DELAY' | 'POLICE_STOP' | 'OTHER';
type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'REPORTED' | 'RESOLVED' | 'PENDING';
type ParcelStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED';

interface Driver {
  name: string;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  points: number;
  status: 'ACTIVE' | 'OFF_DUTY';
  phone: string;
}

interface Checkpoint {
  id: string;
  name: string;
  location: string;
  status: CheckpointStatus;
  timestamp?: string;
  order: number;
}

interface Parcel {
  id: string;
  destination: string;
  recipient: string;
  status: ParcelStatus;
  weight: string;
}

interface Trip {
  id: string;
  route: string;
  origin: string;
  destination: string;
  vehiclePlate: string;
  vehicleType: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  status: TripStatus;
  parcelCount: number;
  earnings: number;
  progress: number;
  checkpoints: Checkpoint[];
  parcels: Parcel[];
}

interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  location: string;
  timestamp: string;
  status: IncidentStatus;
  tripId: string;
}

interface EarningRecord {
  label: string;
  amount: number;
}

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  description: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'EARNING' | 'BONUS' | 'REDEMPTION';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const driverData: Driver = {
  name: 'Rajab M.',
  rating: 4.8,
  totalTrips: 156,
  totalEarnings: 4250000,
  points: 2340,
  status: 'ACTIVE',
  phone: '+255 712 345 678',
};

const activeTrip: Trip = {
  id: 'TRIP-DAR-ARU-001',
  route: 'Dar es Salaam → Arusha',
  origin: 'Dar es Salaam',
  destination: 'Arusha',
  vehiclePlate: 'T123 ABC',
  vehicleType: 'Heavy Truck',
  departureTime: '06:00 AM',
  arrivalTime: '08:30 PM',
  date: '2024-01-15',
  status: 'IN_PROGRESS',
  parcelCount: 12,
  earnings: 185000,
  progress: 60,
  checkpoints: [
    { id: 'cp1', name: 'Dar es Salaam Depot', location: 'Dar es Salaam', status: 'REACHED', timestamp: '06:15 AM', order: 1 },
    { id: 'cp2', name: 'Morogoro Checkpoint', location: 'Morogoro', status: 'REACHED', timestamp: '10:30 AM', order: 2 },
    { id: 'cp3', name: 'Dodoma Hub', location: 'Dodoma', status: 'REACHED', timestamp: '02:45 PM', order: 3 },
    { id: 'cp4', name: 'Kondoa Transit', location: 'Kondoa', status: 'NOT_REACHED', order: 4 },
    { id: 'cp5', name: 'Arusha Terminal', location: 'Arusha', status: 'NOT_REACHED', order: 5 },
  ],
  parcels: [
    { id: 'PCL-001', destination: 'Arusha', recipient: 'Juma Traders', status: 'IN_TRANSIT', weight: '45 kg' },
    { id: 'PCL-002', destination: 'Arusha', recipient: 'Safari Logistics', status: 'IN_TRANSIT', weight: '120 kg' },
    { id: 'PCL-003', destination: 'Dodoma', recipient: 'Central Store', status: 'DELIVERED', weight: '30 kg' },
    { id: 'PCL-004', destination: 'Arusha', recipient: 'Kili Mart', status: 'IN_TRANSIT', weight: '85 kg' },
  ],
};

const upcomingTrips: Trip[] = [
  { id: 'TRIP-ARU-MOS-002', route: 'Arusha → Moshi', origin: 'Arusha', destination: 'Moshi', vehiclePlate: 'T456 DEF', vehicleType: 'Medium Truck', departureTime: '07:00 AM', arrivalTime: '12:00 PM', date: '2024-01-16', status: 'SCHEDULED', parcelCount: 8, earnings: 95000, progress: 0, checkpoints: [], parcels: [] },
  { id: 'TRIP-MOS-DAR-003', route: 'Moshi → Dar es Salaam', origin: 'Moshi', destination: 'Dar es Salaam', vehiclePlate: 'T789 GHI', vehicleType: 'Heavy Truck', departureTime: '05:30 AM', arrivalTime: '09:00 PM', date: '2024-01-17', status: 'SCHEDULED', parcelCount: 15, earnings: 220000, progress: 0, checkpoints: [], parcels: [] },
  { id: 'TRIP-DAR-MBW-004', route: 'Dar es Salaam → Mtwara', origin: 'Dar es Salaam', destination: 'Mtwara', vehiclePlate: 'T321 JKL', vehicleType: 'Heavy Truck', departureTime: '04:00 AM', arrivalTime: '07:00 PM', date: '2024-01-18', status: 'SCHEDULED', parcelCount: 10, earnings: 175000, progress: 0, checkpoints: [], parcels: [] },
  { id: 'TRIP-DAR-ZNZ-005', route: 'Dar es Salaam → Zanzibar', origin: 'Dar es Salaam', destination: 'Zanzibar', vehiclePlate: 'T654 MNO', vehicleType: 'Ferry Cargo', departureTime: '08:00 AM', arrivalTime: '11:30 AM', date: '2024-01-19', status: 'SCHEDULED', parcelCount: 20, earnings: 85000, progress: 0, checkpoints: [], parcels: [] },
  { id: 'TRIP-ARU-DOD-006', route: 'Arusha → Dodoma', origin: 'Arusha', destination: 'Dodoma', vehiclePlate: 'T987 PQR', vehicleType: 'Medium Truck', departureTime: '06:00 AM', arrivalTime: '04:00 PM', date: '2024-01-20', status: 'SCHEDULED', parcelCount: 6, earnings: 135000, progress: 0, checkpoints: [], parcels: [] },
];

const pastTrips: Trip[] = [
  { id: 'TRIP-DAR-ARU-007', route: 'Dar es Salaam → Arusha', origin: 'Dar es Salaam', destination: 'Arusha', vehiclePlate: 'T123 ABC', vehicleType: 'Heavy Truck', departureTime: '05:30 AM', arrivalTime: '08:00 PM', date: '2024-01-10', status: 'COMPLETED', parcelCount: 14, earnings: 190000, progress: 100, checkpoints: [], parcels: [] },
  { id: 'TRIP-ARU-DAR-008', route: 'Arusha → Dar es Salaam', origin: 'Arusha', destination: 'Dar es Salaam', vehiclePlate: 'T456 DEF', vehicleType: 'Heavy Truck', departureTime: '06:00 AM', arrivalTime: '09:30 PM', date: '2024-01-08', status: 'COMPLETED', parcelCount: 11, earnings: 185000, progress: 100, checkpoints: [], parcels: [] },
  { id: 'TRIP-DOD-MOS-009', route: 'Dodoma → Moshi', origin: 'Dodoma', destination: 'Moshi', vehiclePlate: 'T789 GHI', vehicleType: 'Medium Truck', departureTime: '07:00 AM', arrivalTime: '06:00 PM', date: '2024-01-05', status: 'COMPLETED', parcelCount: 7, earnings: 155000, progress: 100, checkpoints: [], parcels: [] },
  { id: 'TRIP-DAR-MBW-010', route: 'Dar es Salaam → Mtwara', origin: 'Dar es Salaam', destination: 'Mtwara', vehiclePlate: 'T321 JKL', vehicleType: 'Heavy Truck', departureTime: '04:30 AM', arrivalTime: '06:30 PM', date: '2024-01-02', status: 'COMPLETED', parcelCount: 9, earnings: 170000, progress: 100, checkpoints: [], parcels: [] },
  { id: 'TRIP-MOS-ARU-011', route: 'Moshi → Arusha', origin: 'Moshi', destination: 'Arusha', vehiclePlate: 'T654 MNO', vehicleType: 'Light Truck', departureTime: '09:00 AM', arrivalTime: '01:00 PM', date: '2023-12-28', status: 'COMPLETED', parcelCount: 5, earnings: 75000, progress: 100, checkpoints: [], parcels: [] },
  { id: 'TRIP-DAR-DOD-012', route: 'Dar es Salaam → Dodoma', origin: 'Dar es Salaam', destination: 'Dodoma', vehiclePlate: 'T987 PQR', vehicleType: 'Heavy Truck', departureTime: '05:00 AM', arrivalTime: '03:30 PM', date: '2023-12-22', status: 'COMPLETED', parcelCount: 13, earnings: 160000, progress: 100, checkpoints: [], parcels: [] },
  { id: 'TRIP-ARU-MBW-013', route: 'Arusha → Mtwara', origin: 'Arusha', destination: 'Mtwara', vehiclePlate: 'T147 STU', vehicleType: 'Heavy Truck', departureTime: '04:00 AM', arrivalTime: '10:00 PM', date: '2023-12-15', status: 'COMPLETED', parcelCount: 16, earnings: 250000, progress: 100, checkpoints: [], parcels: [] },
  { id: 'TRIP-DOD-DAR-014', route: 'Dodoma → Dar es Salaam', origin: 'Dodoma', destination: 'Dar es Salaam', vehiclePlate: 'T258 VWX', vehicleType: 'Medium Truck', departureTime: '06:00 AM', arrivalTime: '05:00 PM', date: '2023-12-10', status: 'COMPLETED', parcelCount: 8, earnings: 140000, progress: 100, checkpoints: [], parcels: [] },
];

const incidents: Incident[] = [
  { id: 'INC-001', type: 'DELAY', severity: 'medium', description: 'Traffic congestion at Morogoro due to road construction. Delayed by 45 minutes.', location: 'Morogoro', timestamp: '2024-01-10 10:15 AM', status: 'RESOLVED', tripId: 'TRIP-DAR-ARU-007' },
  { id: 'INC-002', type: 'BREAKDOWN', severity: 'high', description: 'Minor engine overheating. Resolved after 30 minutes cooling and fluid check.', location: 'Dodoma', timestamp: '2024-01-05 01:30 PM', status: 'RESOLVED', tripId: 'TRIP-DOD-MOS-009' },
];

const weeklyEarnings: EarningRecord[] = [
  { label: 'Mon', amount: 185000 },
  { label: 'Tue', amount: 95000 },
  { label: 'Wed', amount: 0 },
  { label: 'Thu', amount: 170000 },
  { label: 'Fri', amount: 135000 },
  { label: 'Sat', amount: 75000 },
  { label: 'Sun', amount: 0 },
];

const rewards: Reward[] = [
  { id: 'RWD-001', name: 'TSh 10,000 Bonus', pointsCost: 500, description: 'Cash bonus added to next payout' },
  { id: 'RWD-002', name: 'Fuel Voucher', pointsCost: 300, description: 'TSh 5,000 fuel voucher' },
  { id: 'RWD-003', name: 'Priority Trip', pointsCost: 200, description: 'Get priority on next trip assignment' },
  { id: 'RWD-004', name: 'Weekend Off', pointsCost: 1000, description: 'Request a guaranteed weekend off' },
  { id: 'RWD-005', name: 'TSh 50,000 Bonus', pointsCost: 2000, description: 'Big cash bonus for top drivers' },
];

const transactions: Transaction[] = [
  { id: 'TXN-001', description: 'Trip TRIP-DAR-ARU-007', amount: 190000, date: '2024-01-10', type: 'EARNING' },
  { id: 'TXN-002', description: 'Performance Bonus', amount: 50000, date: '2024-01-08', type: 'BONUS' },
  { id: 'TXN-003', description: 'Trip TRIP-ARU-DAR-008', amount: 185000, date: '2024-01-08', type: 'EARNING' },
  { id: 'TXN-004', description: 'Fuel Voucher Redemption', amount: -5000, date: '2024-01-07', type: 'REDEMPTION' },
  { id: 'TXN-005', description: 'Trip TRIP-DOD-MOS-009', amount: 155000, date: '2024-01-05', type: 'EARNING' },
  { id: 'TXN-006', description: 'Trip TRIP-DAR-MBW-010', amount: 170000, date: '2024-01-02', type: 'EARNING' },
  { id: 'TXN-007', description: 'Weekly Safety Bonus', amount: 25000, date: '2024-01-01', type: 'BONUS' },
];

// ─── Utility Functions ────────────────────────────────────────────────────────

const formatCurrency = (amount: number) => `TSh ${amount.toLocaleString()}`;

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    SCHEDULED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    IN_PROGRESS: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    COMPLETED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    CANCELLED: 'bg-red-500/20 text-red-300 border-red-500/30',
    REPORTED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    RESOLVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    PENDING: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    ACTIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    OFF_DUTY: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };
  return styles[status] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
};

const severityBadge = (severity: IncidentSeverity) => {
  const styles: Record<string, string> = {
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return styles[severity];
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

function ProfileHeader({ driver, onToggleStatus }: { driver: Driver; onToggleStatus: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/60 to-slate-900/80 border border-white/10 p-5 backdrop-blur-md">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
            <User className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Driver: {driver.name}
              <button
                onClick={onToggleStatus}
                className={`px-3 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  driver.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-slate-500/20 text-slate-300 border-slate-500/40 hover:bg-slate-500/30'
                }`}
              >
                {driver.status === 'ACTIVE' ? '● Active' : '○ Off Duty'}
              </button>
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-300">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                {driver.rating}
              </span>
              <span className="text-slate-500">|</span>
              <span className="flex items-center gap-1">
                <Truck className="w-4 h-4 text-emerald-400" />
                {driver.totalTrips} trips
              </span>
              <span className="text-slate-500">|</span>
              <span className="flex items-center gap-1">
                <Phone className="w-4 h-4 text-emerald-400" />
                {driver.phone}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Trophy className="w-4 h-4" />
            <span className="text-lg font-bold">{driver.points.toLocaleString()}</span>
            <span className="text-xs text-slate-400">pts</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Total Earnings
          </div>
          <div className="text-base font-bold text-white">{formatCurrency(driver.totalEarnings)}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Today
          </div>
          <div className="text-base font-bold text-emerald-400">{formatCurrency(185000)}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> This Week
          </div>
          <div className="text-base font-bold text-white">{formatCurrency(660000)}</div>
        </div>
      </div>
    </div>
  );
}

function ActiveTripCard({ trip, onViewDetail }: { trip: Trip; onViewDetail: (t: Trip) => void }) {
  const [progress, setProgress] = useState(trip.progress);
  const currentCheckpoint = trip.checkpoints.filter(c => c.status === 'REACHED').length;

  const handleDepart = () => { if (progress < 100) setProgress(p => Math.min(p + 20, 100)); };
  const handleArrive = () => { if (progress < 100) setProgress(p => Math.min(p + 25, 100)); };
  const handleComplete = () => { setProgress(100); };

  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Navigation className="w-5 h-5 text-emerald-400" />
              Active Trip
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">{trip.id}</p>
          </div>
          <Badge className={statusBadge(trip.status)}>{trip.status.replace('_', ' ')}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{trip.origin.slice(0, 3)}</div>
              <div className="text-xs text-slate-400">{trip.origin}</div>
            </div>
            <div className="flex flex-col items-center px-3">
              <ArrowRight className="w-5 h-5 text-emerald-400" />
              <span className="text-xs text-slate-500 mt-0.5">{trip.vehiclePlate}</span>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{trip.destination.slice(0, 3)}</div>
              <div className="text-xs text-slate-400">{trip.destination}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-slate-300">
              <Clock className="w-4 h-4 text-emerald-400" />
              {trip.departureTime}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
              <Package className="w-3 h-3" />
              {trip.parcelCount} parcels
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Trip Progress</span>
            <span className="text-xs text-emerald-400 font-medium">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-slate-500">{currentCheckpoint}/{trip.checkpoints.length} checkpoints</span>
            <span className="text-xs text-emerald-400">{formatCurrency(trip.earnings)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleDepart} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
            <Play className="w-3 h-3 mr-1" /> Depart
          </Button>
          <Button size="sm" onClick={handleArrive} variant="outline" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs">
            <MapPin className="w-3 h-3 mr-1" /> Checkpoint
          </Button>
          <Button size="sm" onClick={handleComplete} variant="outline" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs">
            <Flag className="w-3 h-3 mr-1" /> Complete
          </Button>
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" /> Incident
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onViewDetail(trip)} className="text-slate-300 hover:text-white text-xs ml-auto">
            Details <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingTripsList({ trips, onViewDetail }: { trips: Trip[]; onViewDetail: (t: Trip) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-emerald-400" /> Upcoming Trips
      </h3>
      {trips.map(trip => (
        <div
          key={trip.id}
          onClick={() => onViewDetail(trip)}
          className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-all"
        >
          <div>
            <div className="text-sm font-medium text-white">{trip.route}</div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {trip.date}</span>
              <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {trip.parcelCount} parcels</span>
              <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {trip.vehiclePlate}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-emerald-400">{formatCurrency(trip.earnings)}</div>
            <ChevronRight className="w-4 h-4 text-slate-500 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TripHistoryList({ trips }: { trips: Trip[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Trip History
      </h3>
      <div className="space-y-2">
        {trips.map(trip => (
          <div key={trip.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">{trip.route}</div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {trip.date}</span>
                <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {trip.parcelCount} parcels</span>
              </div>
            </div>
            <div className="text-right">
              <Badge className={statusBadge(trip.status)}>{trip.status.replace('_', ' ')}</Badge>
              <div className="text-xs text-emerald-400 mt-1">{formatCurrency(trip.earnings)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TripDetail({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const [checkpoints, setCheckpoints] = useState(trip.checkpoints);
  const [parcels, setParcels] = useState(trip.parcels);

  const handleMarkPassed = (id: string) => {
    setCheckpoints(prev =>
      prev.map(cp =>
        cp.id === id ? { ...cp, status: 'REACHED' as CheckpointStatus, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : cp
      )
    );
  };

  const handleMarkDelivered = (id: string) => {
    setParcels(prev =>
      prev.map(p => (p.id === id ? { ...p, status: 'DELIVERED' as ParcelStatus } : p))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-300 hover:text-white">
          ← Back
        </Button>
        <div>
          <h2 className="text-lg font-bold text-white">{trip.route}</h2>
          <p className="text-xs text-slate-400">{trip.id} • {trip.vehiclePlate} • {trip.vehicleType}</p>
        </div>
      </div>

      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" /> Route Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between px-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-emerald-400">{trip.origin[0]}</span>
              </div>
              <div className="text-sm font-medium text-white mt-2">{trip.origin}</div>
              <div className="text-xs text-slate-400">{trip.departureTime}</div>
            </div>
            <div className="flex-1 px-6">
              <div className="h-1 bg-slate-700 rounded-full relative">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                  style={{ width: `${trip.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-center mt-2 gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {trip.departureTime}</span>
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {trip.arrivalTime}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center mx-auto">
                <span className="text-lg font-bold text-slate-400">{trip.destination[0]}</span>
              </div>
              <div className="text-sm font-medium text-white mt-2">{trip.destination}</div>
              <div className="text-xs text-slate-400">{trip.arrivalTime}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-emerald-400" /> Checkpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-4">
            {checkpoints.map((cp, idx) => (
              <div key={cp.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-slate-700 last:hidden" style={{ height: idx < checkpoints.length - 1 ? '100%' : '0' }} />
                <div className="relative z-10 mt-0.5">
                  {cp.status === 'REACHED' ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center">
                      <CircleDot className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-sm font-medium ${cp.status === 'REACHED' ? 'text-white' : 'text-slate-400'}`}>
                        {cp.name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> {cp.location}
                        {cp.timestamp && <span className="text-emerald-400">• {cp.timestamp}</span>}
                      </div>
                    </div>
                    {cp.status === 'NOT_REACHED' && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkPassed(cp.id)}
                        className="bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs"
                      >
                        Mark Passed
                      </Button>
                    )}
                    {cp.status === 'REACHED' && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Passed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" /> Parcels ({parcels.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {parcels.map(parcel => (
              <div key={parcel.id} className="bg-white/5 border border-white/5 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{parcel.id}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {parcel.destination} • {parcel.recipient} • {parcel.weight}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={
                    parcel.status === 'DELIVERED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }>
                    {parcel.status}
                  </Badge>
                  {parcel.status !== 'DELIVERED' && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkDelivered(parcel.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                    >
                      Deliver
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EarningsRewards({ driver }: { driver: Driver }) {
  const [points, setPoints] = useState(driver.points);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  const handleRedeem = (reward: Reward) => {
    setSelectedReward(reward);
    setShowRedeemDialog(true);
  };

  const confirmRedeem = () => {
    if (selectedReward && points >= selectedReward.pointsCost) {
      setPoints(p => p - selectedReward.pointsCost);
    }
    setShowRedeemDialog(false);
    setSelectedReward(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-emerald-900/60 to-slate-900/80 rounded-xl p-4 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Today</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(185000)}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/60 to-slate-900/80 rounded-xl p-4 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">This Week</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(660000)}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/60 to-slate-900/80 rounded-xl p-4 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">This Month</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(850000)}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-900/60 to-slate-900/80 rounded-xl p-4 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-medium">Total</span>
          </div>
          <div className="text-xl font-bold text-white">{formatCurrency(driver.totalEarnings)}</div>
        </div>
      </div>

      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Weekly Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyEarnings}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v: number) => `TSh ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#10b981' }}
                  formatter={(value: number) => [formatCurrency(value), 'Earnings']}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" /> Rewards Store
            <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" /> {points.toLocaleString()} pts
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rewards.map(reward => (
              <div key={reward.id} className="bg-white/5 border border-white/5 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{reward.name}</div>
                  <div className="text-xs text-slate-400">{reward.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> {reward.pointsCost}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleRedeem(reward)}
                    disabled={points < reward.pointsCost}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs"
                  >
                    Redeem
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-3">
              {transactions.map(txn => (
                <div key={txn.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <div className="text-sm text-white">{txn.description}</div>
                    <div className="text-xs text-slate-400">{txn.date}</div>
                  </div>
                  <div className={`text-sm font-medium ${txn.type === 'REDEMPTION' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {txn.type === 'REDEMPTION' ? '' : '+'}{formatCurrency(txn.amount)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-400" /> Confirm Redemption
            </DialogTitle>
          </DialogHeader>
          {selectedReward && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                <div className="text-lg font-bold text-white">{selectedReward.name}</div>
                <div className="text-sm text-slate-400">{selectedReward.description}</div>
                <div className="text-sm text-amber-400 mt-2 flex items-center gap-1">
                  <Trophy className="w-4 h-4" /> Cost: {selectedReward.pointsCost} points
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  Your balance: {points.toLocaleString()} points
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRedeemDialog(false)} className="flex-1 border-white/10 text-slate-300 hover:bg-white/5">
                  Cancel
                </Button>
                <Button onClick={confirmRedeem} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IncidentsTab() {
  const [incidentList, setIncidentList] = useState<Incident[]>(incidents);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'DELAY' as IncidentType,
    severity: 'medium' as IncidentSeverity,
    description: '',
    location: '',
    tripId: '',
  });

  const handleSubmit = () => {
    if (!form.description.trim() || !form.location.trim()) return;
    const newIncident: Incident = {
      id: `INC-${String(incidentList.length + 1).padStart(3, '0')}`,
      type: form.type,
      severity: form.severity,
      description: form.description,
      location: form.location,
      tripId: form.tripId || activeTrip.id,
      timestamp: new Date().toLocaleString(),
      status: 'REPORTED',
    };
    setIncidentList([newIncident, ...incidentList]);
    setForm({ type: 'DELAY', severity: 'medium', description: '', location: '', tripId: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full bg-amber-600 hover:bg-amber-500 text-white">
          <AlertCircle className="w-4 h-4 mr-2" /> Report New Incident
        </Button>
      )}

      {showForm && (
        <Card className="bg-white/5 backdrop-blur-md border-white/10">
          <CardHeader>
            <CardTitle className="text-sm text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Report Incident
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as IncidentType })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ACCIDENT">Accident</option>
                  <option value="BREAKDOWN">Breakdown</option>
                  <option value="DELAY">Delay</option>
                  <option value="POLICE_STOP">Police Stop</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Severity</label>
                <select
                  value={form.severity}
                  onChange={e => setForm({ ...form, severity: e.target.value as IncidentSeverity })}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the incident..."
                rows={3}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Location</label>
                <Input
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Morogoro"
                  className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Trip ID</label>
                <Input
                  value={form.tripId}
                  onChange={e => setForm({ ...form, tripId: e.target.value })}
                  placeholder={activeTrip.id}
                  className="bg-slate-800 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <Button onClick={handleSubmit} className="w-full bg-amber-600 hover:bg-amber-500 text-white">
              Submit Report
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" /> Reported Incidents ({incidentList.length})
        </h3>
        {incidentList.map(incident => (
          <div key={incident.id} className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{incident.id}</span>
                <Badge className={severityBadge(incident.severity)}>{incident.severity}</Badge>
                <Badge className={statusBadge(incident.status)}>{incident.status}</Badge>
              </div>
              <span className="text-xs text-slate-500">{incident.timestamp}</span>
            </div>
            <div className="text-sm text-slate-300">{incident.description}</div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {incident.location}</span>
              <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {incident.tripId}</span>
              <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {incident.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CargoDriver() {
  const [driver, setDriver] = useState<Driver>(driverData);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState('trips');

  const toggleStatus = () => {
    setDriver(prev => ({
      ...prev,
      status: prev.status === 'ACTIVE' ? 'OFF_DUTY' : 'ACTIVE',
    }));
  };

  const handleViewTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    setActiveTab('detail');
  };

  const handleBack = () => {
    setSelectedTrip(null);
    setActiveTab('trips');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 bg-slate-900/50 backdrop-blur-md px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">KOBECARGO Driver</h1>
              <p className="text-xs text-slate-400">Driver Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${driver.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-xs text-slate-400">{driver.status === 'ACTIVE' ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-white/5 border border-white/10 backdrop-blur-md grid grid-cols-4 h-10">
              <TabsTrigger value="trips" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
                <Truck className="w-3.5 h-3.5 mr-1" /> My Trips
              </TabsTrigger>
              <TabsTrigger value="detail" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
                <MapPin className="w-3.5 h-3.5 mr-1" /> Trip Detail
              </TabsTrigger>
              <TabsTrigger value="earnings" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
                <DollarSign className="w-3.5 h-3.5 mr-1" /> Earnings
              </TabsTrigger>
              <TabsTrigger value="incidents" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Incidents
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trips" className="mt-4 space-y-4 focus-visible:outline-none">
              <ProfileHeader driver={driver} onToggleStatus={toggleStatus} />
              <ActiveTripCard trip={activeTrip} onViewDetail={handleViewTrip} />
              <UpcomingTripsList trips={upcomingTrips} onViewDetail={handleViewTrip} />
              <TripHistoryList trips={pastTrips} />
            </TabsContent>

            <TabsContent value="detail" className="mt-4 focus-visible:outline-none">
              {selectedTrip ? (
                <TripDetail trip={selectedTrip} onBack={handleBack} />
              ) : (
                <div className="text-center py-16">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <div className="text-slate-400 text-sm">Select a trip from My Trips to view details</div>
                  <Button onClick={() => setActiveTab('trips')} variant="outline" className="mt-4 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
                    Go to My Trips
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="earnings" className="mt-4 focus-visible:outline-none">
              <EarningsRewards driver={driver} />
            </TabsContent>

            <TabsContent value="incidents" className="mt-4 focus-visible:outline-none">
              <IncidentsTab />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/10 bg-slate-900/50 backdrop-blur-md px-5 py-3 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Truck className="w-3 h-3 text-emerald-500" />
          <span className="font-medium text-emerald-500">KOBECARGO</span>
        </div>
        <span>Driver App v1.0</span>
        <span>&copy; {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
