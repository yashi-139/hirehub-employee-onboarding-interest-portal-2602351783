import React from 'react';
import PropTypes from 'prop-types';

/**
 * Format a persisted timestamp for compact, local dashboard display.
 *
 * @param {string} value - ISO timestamp to format.
 * @returns {string} A human-readable date or N/A for invalid values.
 */
export function formatSubmissionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Render submission data and row-level management actions.
 *
 * @param {{ submissions: Array<object>, onEdit: (submission: object) => void, onDelete: (submission: object) => void }} props - Data and action handlers.
 * @returns {JSX.Element} A responsive submission table or its empty state.
 */
function SubmissionTable({ submissions, onEdit, onDelete, emptyMessage = 'No submissions yet.' }) {
  if (submissions.length === 0) {
    return <p className="submissions-empty">{emptyMessage}</p>;
  }

  return (
    <div className="submission-table-wrapper" tabIndex="0" aria-label="Scrollable submissions table">
      <table className="submission-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Full Name</th>
            <th scope="col">Email</th>
            <th scope="col">Mobile</th>
            <th scope="col">Department</th>
            <th scope="col">Submitted On</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((submission, index) => (
            <tr key={submission.id}>
              <td>{index + 1}</td>
              <td>{submission.fullName}</td>
              <td>{submission.email}</td>
              <td>{submission.mobile}</td>
              <td><span className="department-pill">{submission.department}</span></td>
              <td>{formatSubmissionDate(submission.submittedAt)}</td>
              <td className="submission-actions">
                <button type="button" className="table-action" onClick={() => onEdit(submission)}>
                  Edit
                </button>
                <button type="button" className="table-action table-action-danger" onClick={() => onDelete(submission)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

SubmissionTable.propTypes = {
  submissions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    fullName: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    mobile: PropTypes.string.isRequired,
    department: PropTypes.string.isRequired,
    submittedAt: PropTypes.string.isRequired,
  })).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  emptyMessage: PropTypes.string,
};

export default SubmissionTable;
