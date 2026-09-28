import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionMonitor from '../src/SessionMonitor.jsx';

const SESSIONS = [
  {
    id: 1,
    username: 'alice',
    client_id: 'demo-storefront',
    issued_at: '2026-01-01T10:00:00Z',
    ip: '127.0.0.1',
  },
  {
    id: 2,
    username: 'bob',
    client_id: 'dashboard',
    issued_at: '2026-01-01T11:00:00Z',
    ip: '127.0.0.1',
  },
];

describe("SessionMonitor — admin view of every user's sessions (requirements 2 & 3)", () => {
  it('renders one row per active session, across users', () => {
    render(<SessionMonitor sessions={SESSIONS} onForceSignOut={() => {}} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getAllByText('Force sign out')).toHaveLength(2);
  });

  it('calls onForceSignOut with the correct session id', () => {
    const onForceSignOut = vi.fn();
    render(<SessionMonitor sessions={SESSIONS} onForceSignOut={onForceSignOut} />);
    fireEvent.click(screen.getAllByText('Force sign out')[1]);
    expect(onForceSignOut).toHaveBeenCalledWith(2);
  });

  it('shows an empty state when nobody is signed in anywhere', () => {
    render(<SessionMonitor sessions={[]} onForceSignOut={() => {}} />);
    expect(screen.getByText(/no active sessions/i)).toBeInTheDocument();
  });
});
