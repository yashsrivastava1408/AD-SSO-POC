import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Sidebar from '../src/Sidebar.jsx';

describe('Sidebar — admin nav gating (requirement 4/5 UI layer)', () => {
  it('hides admin-only nav items for a non-admin user', () => {
    render(<Sidebar active="overview" onNavigate={vi.fn()} isAdmin={false} username="bob" />);
    expect(screen.getByText('My Sessions')).toBeInTheDocument();
    expect(screen.queryByText('Users & Roles')).not.toBeInTheDocument();
    expect(screen.queryByText('Session Monitor')).not.toBeInTheDocument();
    expect(screen.queryByText('Add User')).not.toBeInTheDocument();
  });

  it('shows admin-only nav items for an admin user', () => {
    render(<Sidebar active="overview" onNavigate={vi.fn()} isAdmin={true} username="alice" />);
    expect(screen.getByText('Users & Roles')).toBeInTheDocument();
    expect(screen.getByText('Session Monitor')).toBeInTheDocument();
    expect(screen.getByText('Add User')).toBeInTheDocument();
  });
});
