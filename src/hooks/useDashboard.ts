import { useState, useEffect, useCallback } from 'react';
import { IncidenceFilters, IncidenceRecord } from '@/types/incidence';

interface Client {
  id: string;
  name: string;
}

export function useDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [rows, setRows] = useState<IncidenceRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [detail, setDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  const [filters, setFiltersState] = useState<IncidenceFilters>({
    dateFrom: '',
    dateTo: '',
    promoter: '',
    store: '',
    minSeverity: undefined,
    status: '',
    sort: 'captured_desc',
  });

  const limit = 20;

  // Clamped setPage to prevent negative or zero page offsets
  const setPageSafe = useCallback((newPage: number) => {
    const clamped = Math.max(1, Math.floor(newPage));
    setPage(clamped);
  }, []);

  // 1. Fetch available clients on mount
  useEffect(() => {
    let active = true;
    const fetchClients = async () => {
      try {
        const res = await fetch('/api/planogram/clients');
        if (!res.ok) {
          throw new Error(`Error ${res.status}: No se pudieron cargar los clientes.`);
        }
        const data = await res.json();
        if (active && data.clients) {
          setClients(data.clients);
          if (data.clients.length === 1) {
            setSelectedClientId(data.clients[0].id);
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Error al conectar con la API.');
        }
      }
    };

    fetchClients();
    return () => {
      active = false;
    };
  }, []);

  // 2. Fetch incidences when filters, selected client, or page changes
  const fetchIncidences = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      
      // Map filters to query parameters according to the contract
      if (filters.dateFrom) queryParams.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.set('dateTo', filters.dateTo);
      if (filters.promoter) queryParams.set('promoter', filters.promoter);
      if (filters.store) queryParams.set('store', filters.store);
      if (filters.minSeverity) queryParams.set('minSeverity', filters.minSeverity);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.sort) queryParams.set('sort', filters.sort);
      
      // Selected client ID parameter (comes from selector or hook auto-assignment)
      if (selectedClientId) {
        queryParams.set('clientId', selectedClientId);
      }

      // Pagination limits
      const offset = (page - 1) * limit;
      queryParams.set('limit', limit.toString());
      queryParams.set('offset', offset.toString());

      const res = await fetch(`/api/planogram/incidences?${queryParams.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${res.status} al consultar incidencias.`);
      }

      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedClientId, page]);

  useEffect(() => {
    // Only fetch if client configuration is ready (i.e. if we have loaded clients)
    if (clients.length > 0) {
      fetchIncidences();
    }
  }, [fetchIncidences, clients.length]);

  // Actions
  const setFilters = useCallback((newFilters: Partial<IncidenceFilters>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...newFilters };
      // Validate date range if both present to prevent empty queries
      if (next.dateFrom && next.dateTo) {
        const fromDate = new Date(next.dateFrom);
        const toDate = new Date(next.dateTo);
        if (fromDate > toDate) {
          next.dateTo = '';
          setError('La fecha final debe ser posterior a la fecha inicial.');
        }
      }
      return next;
    });
    setPageSafe(1); // reset to page 1 on filter changes
  }, [setPageSafe]);

  const openDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/planogram/incidences/${id}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${res.status} al cargar detalle.`);
      }
      const data = await res.json();
      setDetail(data.incidence || null);
    } catch (err: any) {
      setError(err.message || 'Error al obtener detalle de la incidencia.');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
  }, []);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  // Derive active client name for empty states
  const selectedClientName = clients.find((c) => c.id === selectedClientId)?.name || '';

  return {
    rows,
    total,
    loading,
    error,
    clearError,
    filters,
    setFilters,
    page,
    setPage: setPageSafe,
    clients,
    selectedClientId,
    setSelectedClientId,
    selectedClientName,
    detail,
    isDetailLoading,
    openDetail,
    closeDetail,
    limit,
    refetch: fetchIncidences,
  };
}
