import React from 'react';
export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast">
      <div className="toast-title">{toast.title}</div>
      {toast.msg && <div className="toast-msg">{toast.msg}</div>}
    </div>
  );
}
