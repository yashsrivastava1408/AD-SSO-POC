import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsersTable from '../src/UsersTable.jsx';

const USERS = [
  { uid: 'alice', cn: 'Alice Admin', groups: ['Admins'] },
  { uid: 'bob', cn: 'Bob Employee', groups: ['Employees'] },
];

describe('UsersTable — AD directory listing (requirement 4)', () => {
  it('renders every user with their AD groups', () => {
    render(<UsersTable users={USERS} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('Admins')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
  });

  it('shows an empty state when the directory has no users', () => {
    render(<UsersTable users={[]} />);
    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
  });
});
