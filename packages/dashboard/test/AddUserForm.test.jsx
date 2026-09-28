import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddUserForm from '../src/AddUserForm.jsx';

describe('AddUserForm — provisions a new AD account (requirement 4)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits username, password and group to the admin API', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { uid: 'dave', groups: ['Employees'] } }),
    });
    const onCreated = vi.fn();
    render(<AddUserForm onCreated={onCreated} />);

    fireEvent.change(screen.getByPlaceholderText('dave'), { target: { value: 'dave' } });
    fireEvent.change(screen.getByPlaceholderText('Password123'), { target: { value: 'secretpw' } });
    fireEvent.click(screen.getByText('Create user in Active Directory'));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'dave', password: 'secretpw', group: 'Employees' }),
        })
      )
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(await screen.findByText(/Created "dave"/)).toBeInTheDocument();
  });

  it('shows the server error message when creation fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'a user with that username already exists' }),
    });
    render(<AddUserForm onCreated={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('dave'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Password123'), { target: { value: 'secretpw' } });
    fireEvent.click(screen.getByText('Create user in Active Directory'));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });
});
