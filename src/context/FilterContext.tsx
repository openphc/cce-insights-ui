import { createContext, useState, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDefaultDateRange } from '../utils/dates';
import { getEnv } from '../env';

const defaultDays = Number(getEnv('VITE_DEFAULT_DATE_RANGE_DAYS') || 90);

export interface FilterContextValue {
  startDate: string;
  endDate: string;
  facilityId: string | undefined;
  setDateRange: (start: string, end: string) => void;
  setFacilityId: (id: string | undefined) => void;
}

const defaults = getDefaultDateRange(defaultDays);

export const FilterContext = createContext<FilterContextValue>({
  startDate: defaults.startDate,
  endDate: defaults.endDate,
  facilityId: undefined,
  setDateRange: () => {},
  setFacilityId: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [startDate, setStartDate] = useState(
    searchParams.get('startDate') || defaults.startDate,
  );
  const [endDate, setEndDate] = useState(
    searchParams.get('endDate') || defaults.endDate,
  );
  const [facilityId, setFacilityIdState] = useState<string | undefined>(
    searchParams.get('facilityId') || undefined,
  );

  const setDateRange = useCallback(
    (start: string, end: string) => {
      setStartDate(start);
      setEndDate(end);
      setSearchParams((prev) => {
        prev.set('startDate', start);
        prev.set('endDate', end);
        return prev;
      });
    },
    [setSearchParams],
  );

  const setFacilityId = useCallback(
    (id: string | undefined) => {
      setFacilityIdState(id);
      setSearchParams((prev) => {
        if (id) prev.set('facilityId', id);
        else prev.delete('facilityId');
        return prev;
      });
    },
    [setSearchParams],
  );

  return (
    <FilterContext.Provider value={{ startDate, endDate, facilityId, setDateRange, setFacilityId }}>
      {children}
    </FilterContext.Provider>
  );
}
