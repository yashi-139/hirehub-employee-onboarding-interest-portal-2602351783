import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import AdminLogin from '../components/AdminLogin';
import EditModal from '../components/EditModal';
import SubmissionTable, { formatSubmissionDate } from '../components/SubmissionTable';
import {
  deleteSubmission,
  filterSubmissions,
  getSubmissionDepartments,
  getSubmissions,
  updateSubmission,
} from '../utils/storage';

/** Return whether the current browser session has local administrator access. */
function isAuthenticated() {
  return sessionStorage.getItem('hirehub_admin_auth') === 'true';
}

/**
 * Render an accessible, focus-managed deletion confirmation dialog.
 *
 * @param {{ onCancel: () => void, onConfirm: () => void }} props - Confirmation handlers.
 * @returns {JSX.Element} The deletion confirmation dialog.
 */
function DeleteConfirmation({ onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(document.activeElement);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    /** Close on Escape and keep keyboard focus within the dialog. */
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll('button')).filter(
        (element) => !element.disabled,
      );
      if (items.length === 0) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [onCancel]);

  /** Close only when the click originates on the dimmed overlay. */
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) onCancel();
  }

  return (
    <div className="admin-modal-overlay" onMouseDown={handleOverlayClick}>
      <div
        className="admin-modal confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        ref={dialogRef}
        tabIndex="-1"
      >
        <h2 id="delete-confirmation-title">Delete Submission</h2>
        <p>Are you sure you want to delete this submission?</p>
        <div className="dialog-actions">
          <button
            type="button"
            className="admin-secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-danger-button"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

DeleteConfirmation.propTypes = {
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

/** Render the protected administrator dashboard and submission management workflow. */
function AdminDashboard() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(isAuthenticated);
  const [submissions, setSubmissions] = useState(getSubmissions);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [deletingSubmission, setDeletingSubmission] = useState(null);

  const departmentOptions = useMemo(() => getSubmissionDepartments(submissions), [submissions]);

  const filteredSubmissions = useMemo(
    () => filterSubmissions(submissions, { searchTerm, department: selectedDepartment }),
    [searchTerm, selectedDepartment, submissions],
  );

  const stats = useMemo(() => {
    const dates = filteredSubmissions
      .map((submission) => new Date(submission.submittedAt))
      .filter((date) => !Number.isNaN(date.getTime()));
    const latest = dates.length
      ? new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString()
      : '';
    return {
      total: filteredSubmissions.length,
      departments: new Set(filteredSubmissions.map((submission) => submission.department)).size,
      latest,
    };
  }, [filteredSubmissions]);

  /** End the local admin session, synchronize the header, and return home. */
  function handleLogout() {
    sessionStorage.removeItem('hirehub_admin_auth');
    window.dispatchEvent(new Event('hirehub-admin-auth-change'));
    navigate('/');
  }

  /** Clear every dashboard filter and restore the full result set. */
  function handleClearFilters() {
    setSearchTerm('');
    setSelectedDepartment('');
  }

  /** Persist a valid edit and immediately reflect it in the rendered table. */
  function handleSave(updates) {
    if (updateSubmission(editingSubmission.id, updates)) {
      setSubmissions((current) => current.map((item) => (
        item.id === editingSubmission.id ? { ...item, ...updates } : item
      )));
    }
    setEditingSubmission(null);
  }

  /** Delete only after the in-app confirmation dialog is accepted. */
  function handleConfirmDelete() {
    if (deletingSubmission && deleteSubmission(deletingSubmission.id)) {
      setSubmissions((current) => current.filter((item) => item.id !== deletingSubmission.id));
    }
    setDeletingSubmission(null);
  }

  if (!authenticated) {
    return <AdminLogin onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <section className="admin-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-kicker">Candidate pipeline</p>
          <h1 id="dashboard-title">Submissions Dashboard</h1>
        </div>
        <button
          className="admin-logout-button"
          type="button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
      <div className="dashboard-stats" aria-label="Submission summary">
        <article className="stat-card">
          <span>Total Submissions</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="stat-card">
          <span>Departments</span>
          <strong>{stats.departments}</strong>
        </article>
        <article className="stat-card">
          <span>Latest Submission</span>
          <strong>{stats.latest ? formatSubmissionDate(stats.latest) : 'N/A'}</strong>
        </article>
      </div>
      <section className="submissions-section" aria-labelledby="submissions-table-title">
        <div className="submissions-section-header">
          <div>
            <h2 id="submissions-table-title">All Submissions</h2>
            <p className="submissions-section-copy">
              Search candidate details or narrow the table by department without changing stored records.
            </p>
          </div>
          <div className="dashboard-filters" aria-label="Dashboard filters">
            <label className="dashboard-filter-field" htmlFor="submission-search">
              <span>Search submissions</span>
              <input
                id="submission-search"
                name="submission-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, email, or mobile"
              />
            </label>
            <label className="dashboard-filter-field" htmlFor="submission-department-filter">
              <span>Department</span>
              <select
                id="submission-department-filter"
                name="submission-department-filter"
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
              >
                <option value="">All departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="admin-secondary-button dashboard-clear-filters"
              type="button"
              onClick={handleClearFilters}
              disabled={!searchTerm && !selectedDepartment}
            >
              Clear filters
            </button>
          </div>
        </div>
        <SubmissionTable
          submissions={filteredSubmissions}
          onEdit={setEditingSubmission}
          onDelete={setDeletingSubmission}
          emptyMessage={submissions.length === 0 ? 'No submissions yet.' : 'No submissions match the current filters.'}
        />
      </section>
      {editingSubmission && (
        <EditModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSave={handleSave}
        />
      )}
      {deletingSubmission && (
        <DeleteConfirmation
          onCancel={() => setDeletingSubmission(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
}

export default AdminDashboard;