import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountPage } from '../src/App.jsx';

describe('AccountPage — permissions gated by AD group (requirement 5)', () => {
  it('shows the Admin Panel for a user in the Admins AD group', () => {
    render(<AccountPage user={{ username: 'alice', groups: ['Admins'] }} />);
    expect(screen.getByText(/Admin Panel/i)).toBeInTheDocument();
  });

  it('hides the Admin Panel for a user without the Admins AD group', () => {
    render(<AccountPage user={{ username: 'bob', groups: ['Employees'] }} />);
    expect(screen.queryByText(/Admin Panel/i)).not.toBeInTheDocument();
  });

  it('renders the AD groups the user belongs to', () => {
    render(<AccountPage user={{ username: 'bob', groups: ['Employees'] }} />);
    expect(screen.getByText('Employees')).toBeInTheDocument();
  });
});
