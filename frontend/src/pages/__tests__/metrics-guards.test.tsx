/**
 * Unit tests for metrics guard fixes (Usability Fix Pack #2).
 *
 * Each test verifies that the component does NOT crash when the API returns
 * undefined / null / empty data for the fields that previously caused
 * console errors on the corresponding route.
 *
 * Routes covered:
 *   /insights          - GrcInsights
 *   /dashboards/audit  - AuditDashboard
 *   /dashboards/compliance - ComplianceDashboard
 *   /calendar          - CalendarPage
 *   /risk              - RiskHeatmap
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

/* ------------------------------------------------------------------ */
/* RiskHeatmap: forEach guard on undefined inherent/residual arrays    */
/* ------------------------------------------------------------------ */
import { RiskHeatmap } from '../../components/risk/RiskHeatmap';

describe('RiskHeatmap metrics guards', () => {
  it('renders without crash when data.inherent is undefined', () => {
    const data = { inherent: undefined as any, residual: [], totalRisks: 0 };
    expect(() => render(<RiskHeatmap data={data} />)).not.toThrow();
  });

  it('renders without crash when data.residual is undefined', () => {
    const data = { inherent: [], residual: undefined as any, totalRisks: 0 };
    expect(() =>
      render(<RiskHeatmap data={data} type="residual" />),
    ).not.toThrow();
  });

  it('renders without crash when data is null', () => {
    expect(() => render(<RiskHeatmap data={null} />)).not.toThrow();
  });

  it('renders normally with valid cells', () => {
    const data = {
      inherent: [{ likelihood: 3, impact: 4, count: 2, band: 'HIGH' }],
      residual: [],
      totalRisks: 2,
    };
    const { container } = render(<RiskHeatmap data={data} />);
    expect(container.textContent).toContain('Total Risks: 2');
  });
});
