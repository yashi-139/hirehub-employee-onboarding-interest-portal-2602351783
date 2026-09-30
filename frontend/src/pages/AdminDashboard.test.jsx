import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AdminDashboard from './AdminDashboard';
import { SUBMISSIONS_STORAGE_KEY } from '../utils/storage';

/** Render the dashboard with router context. */
function renderDashboard() { return render(<MemoryRouter><AdminDashboard /></MemoryRouter>); }

/** Establish the local admin session for protected dashboard tests. */
function signInSession() { sessionStorage.setItem('hirehub_admin_auth', 'true'); }

const records = [
  { id: 'one', fullName: 'Ava Smith', email: 'ava@example.com', mobile: '1234567890', department: 'Engineering', submittedAt: '2026-03-04T12:00:00.000Z' },
  { id: 'two', fullName: 'Noah Lee', email: 'noah@example.com', mobile: '0987654321', department: 'Design', submittedAt: '2026-03-02T12:00:00.000Z' },
];

describe('AdminDashboard', () => {
  it('rejects invalid credentials and accepts only admin/admin with exact auth storage', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.type(screen.getByPlaceholderText('Enter username'), 'bad');
    await user.type(screen.getByPlaceholderText('Enter password'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials. Please try again.');
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBeNull();
    await user.clear(screen.getByPlaceholderText('Enter username'));
    await user.clear(screen.getByPlaceholderText('Enter password'));
    await user.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await user.type(screen.getByPlaceholderText('Enter password'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(sessionStorage.getItem('hirehub_admin_auth')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Submissions Dashboard' })).toBeInTheDocument();
  });

  it('renders the empty dashboard state and N/A latest date', () => {
    signInSession(); renderDashboard();
    expect(screen.getByText('No submissions yet.')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('calculates summary stats and renders formatted submission data', () => {
    signInSession(); localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(records)); renderDashboard();
    expect(screen.getAllByText('Mar 4, 2026')).toHaveLength(2);
    expect(screen.getByText('Ava Smith')).toBeInTheDocument();
    const summary = screen.getByLabelText('Submission summary');
    expect(within(summary).getAllByText('2')).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search submissions' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeInTheDocument();
  });

  it('filters submissions by case-insensitive search text and updates summary totals', async () => {
    const user = userEvent.setup();
    signInSession();
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(records));
    renderDashboard();

    await user.type(screen.getByRole('searchbox', { name: 'Search submissions' }), 'NOAH');

    expect(screen.getByText('Noah Lee')).toBeInTheDocument();
    expect(screen.queryByText('Ava Smith')).not.toBeInTheDocument();
    const summary = screen.getByLabelText('Submission summary');
    expect(within(summary).getByText('Total Submissions')).toBeInTheDocument();
    expect(within(summary).getByText('Departments')).toBeInTheDocument();
    expect(within(summary).getByText('Latest Submission')).toBeInTheDocument();
    expect(within(summary).getByText('Mar 2, 2026')).toBeInTheDocument();
    expect(within(summary).getAllByText('1')).toHaveLength(2);
  });

  it('combines department filtering with search and surfaces a filtered empty state that can be cleared', async () => {
    const user = userEvent.setup();
    signInSession();
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(records));
    renderDashboard();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Department' }), 'Engineering');
    expect(screen.getByText('Ava Smith')).toBeInTheDocument();
    expect(screen.queryByText('Noah Lee')).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search submissions' }), 'missing');
    expect(screen.getByText('No submissions match the current filters.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Ava Smith')).toBeInTheDocument();
    expect(screen.getByText('Noah Lee')).toBeInTheDocument();
  });

  it('keeps persisted data unchanged when an edit is invalid or cancelled, then saves valid edits', async () => {
    const user = userEvent.setup(); signInSession(); localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(records)); renderDashboard();
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.getByRole('dialog', { name: 'Edit Submission' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeDisabled();
    await user.clear(screen.getByLabelText('Mobile Number'));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByText('Mobile Number is required.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SUBMISSIONS_STORAGE_KEY))[0].mobile).toBe('1234567890');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.clear(screen.getByLabelText('Full Name'));
    await user.type(screen.getByLabelText('Full Name'), 'Ava Jones');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(screen.getByText('Ava Jones')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SUBMISSIONS_STORAGE_KEY))[0].fullName).toBe('Ava Jones');
  });

  it('closes the edit dialog with Escape and only closes on a backdrop click', async () => {
    const user = userEvent.setup();
    signInSession();
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(records));
    renderDashboard();

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Edit Submission' })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Edit Submission' });
    await user.click(dialog);
    expect(dialog).toBeInTheDocument();
    fireEvent.mouseDown(dialog.parentElement);
    expect(screen.queryByRole('dialog', { name: 'Edit Submission' })).not.toBeInTheDocument();
  });

  it('wraps edit-dialog focus in both Tab directions', async () => {
    const user = userEvent.setup();
    signInSession();
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(records));
    renderDashboard();

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Edit Submission' });
    const fullName = within(dialog).getByLabelText('Full Name');
    const saveChanges = within(dialog).getByRole('button', { name: 'Save Changes' });

    fullName.focus();
    await user.tab({ shift: true });
    expect(saveChanges).toHaveFocus();

    await user.tab();
    expect(fullName).toHaveFocus();
  });

  it('requires in-app confirmation before deleting a persisted submission', async () => {
    const user = userEvent.setup(); signInSession(); localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(records)); renderDashboard();
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getByText('Are you sure you want to delete this submission?')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SUBMISSIONS_STORAGE_KEY))).toHaveLength(2);
    await user.click(within(screen.getByRole('dialog', { name: 'Delete Submission' })).getByRole('button', { name: 'Delete', exact: true }));
    expect(screen.queryByText('Ava Smith')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SUBMISSIONS_STORAGE_KEY))).toHaveLength(1);
  });
});
