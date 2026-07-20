import React from "react";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
