import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionsTable from '../src/SessionsTable.jsx';

const SESSIONS = [
  { id: 1, client_id: 'demo-storefront', issued_at: '2026-01-01T10:00:00Z', ip: '127.0.0.1' },
  { id: 2, client_id: 'dashboard', issued_at: '2026-01-01T11:00:00Z', ip: '127.0.0.1' },
];

describe('SessionsTable — login history + per-app sign-out (requirements 2 & 3)', () => {
  it('renders one row per active session', () => {
    render(<SessionsTable sessions={SESSIONS} onSignOut={() => {}} />);
    expect(screen.getByText(/Northmart/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity Dashboard/i)).toBeInTheDocument();
    expect(screen.getAllByText('Sign out')).toHaveLength(2);
  });

  it('calls onSignOut with the correct session id when its button is clicked', () => {
    const onSignOut = vi.fn();
    render(<SessionsTable sessions={SESSIONS} onSignOut={onSignOut} />);
    fireEvent.click(screen.getAllByText('Sign out')[0]);
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledWith(1);
  });

  it('shows an empty state when there are no active sessions', () => {
    render(<SessionsTable sessions={[]} onSignOut={() => {}} />);
    expect(screen.getByText(/no active sessions/i)).toBeInTheDocument();
  });
});
