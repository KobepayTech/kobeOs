import { useState } from 'react';
import AirCargoDesktop, { type AirDesktopView } from './AirCargoDesktop';
import FlightBoard from './FlightBoard';
import CargoOperationsDesk from './CargoOperationsDesk';

/** Desktop entry point registered by the KobeOS cargo manifest. */
export default function KobeAirCargo() {
  const [view, setView] = useState<AirDesktopView>('dashboard');
  return <AirCargoDesktop view={view} onView={setView}>
    {view === 'flights' ? <FlightBoard /> : !['dashboard', 'tracking', 'money'].includes(view) ? <CargoOperationsDesk key={view} view={view} /> : null}
  </AirCargoDesktop>;
}
