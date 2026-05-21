import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock React hooks so we can call the hook under test as a pure function
// in a standard Vitest environment without requiring @testing-library/react
vi.mock('react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, any>;
  let stateMap = new Map();
  let stateIndex = 0;

  const mockReact = {
    ...actual,
    useState: vi.fn((initialValue) => {
      const index = stateIndex++;
      if (!stateMap.has(index)) {
        stateMap.set(index, initialValue);
      }
      const state = stateMap.get(index);
      const setter = vi.fn((newValue) => {
        if (typeof newValue === 'function') {
          stateMap.set(index, newValue(stateMap.get(index)));
        } else {
          stateMap.set(index, newValue);
        }
      });
      return [state, setter];
    }),
    useEffect: vi.fn((callback) => {
      callback();
    }),
    useCallback: vi.fn((callback) => callback),
    _resetMockReact: () => {
      stateMap.clear();
      stateIndex = 0;
    },
    _resetStateIndex: () => {
      stateIndex = 0;
    },
  };

  return {
    ...mockReact,
    default: mockReact,
  };
});

import { useDashboard } from '../useDashboard';
import React from 'react';

describe('useDashboard Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (React as any)._resetMockReact();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ clients: [], rows: [], total: 0 }),
    });
  });

  it('debe inicializar el hook con valores por defecto', () => {
    const hook = useDashboard();
    expect(hook.loading).toBe(false);
    expect(hook.error).toBe('');
    expect(hook.page).toBe(1);
    expect(hook.total).toBe(0);
    expect(hook.rows).toEqual([]);
    expect(hook.filters.sort).toBe('captured_desc');
  });

  it('debe consultar los clientes disponibles al montarse', async () => {
    const mockClients = [{ id: 'cli-1', name: 'Fruit of the Loom' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ clients: mockClients }),
    });

    useDashboard();

    // Verification of the fetch call to clients
    expect(global.fetch).toHaveBeenCalledWith('/api/planogram/clients');
  });

  it('debe disparar fetch de incidencias cuando se llama a refetch', async () => {
    const mockIncidences = [{ id: 'inc-1', store_name: 'Store A' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ rows: mockIncidences, total: 1 }),
    });

    const hook = useDashboard();
    await hook.refetch();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/planogram/incidences')
    );
  });

  it('debe limpiar dateTo y setear un error si se pasa un rango de fechas inválido', () => {
    const hook = useDashboard();
    
    // Proporcionar un rango inválido
    hook.setFilters({
      dateFrom: '2026-05-21',
      dateTo: '2026-05-20',
    });

    // Como es un mock síncrono de React, podemos llamar al hook de nuevo
    // para obtener una instantánea con el estado actualizado tras re-linear el índice.
    (React as any)._resetStateIndex();
    const updatedHook = useDashboard();

    expect(updatedHook.filters.dateTo).toBe('');
    expect(updatedHook.error).toBe('La fecha final debe ser posterior a la fecha inicial.');
  });
});
