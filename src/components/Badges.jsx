import React from 'react';
import { FONTI, ESITI, PROPOSTE, STATI_APPT } from '../constants';

export function StageBadge({ name, stages }) {
  const s = stages?.find(x => x.name === name);
  const color = s ? s.color : '#888';
  return <span className="badge" style={{ background: color + '22', color, border: `1px solid ${color}55` }}>{name || '—'}</span>;
}

export function FonteBadge({ name }) {
  if (!name) return <span className="text-muted fs-12">—</span>;
  const f = FONTI.find(x => x.name === name);
  const color = f ? f.color : '#888';
  return <span className="badge" style={{ background: color + '18', color, border: `1px solid ${color}44`, gap: 3 }}>{f?.icon} {name}</span>;
}

export function EsitoBadge({ name }) {
  if (!name) return <span className="text-muted fs-12">—</span>;
  const e = ESITI.find(x => x.name === name);
  const color = e ? e.color : '#888';
  return <span className="badge" style={{ background: color + '18', color, border: `1px solid ${color}44` }}>{name}</span>;
}

export function PropostaBadge({ name }) {
  if (!name) return <span className="text-muted fs-12">—</span>;
  const p = PROPOSTE.find(x => x.name === name);
  const color = p ? p.color : '#888';
  return <span className="badge" style={{ background: color + '18', color, border: `1px solid ${color}44` }}>{name}</span>;
}

export function StatoBadge({ name }) {
  if (!name) return null;
  const s = STATI_APPT.find(x => x.name === name);
  const color = s ? s.color : '#888';
  return <span className="badge" style={{ background: color + '18', color, border: `1px solid ${color}44`, gap: 3 }}>{s?.icon} {name}</span>;
}
