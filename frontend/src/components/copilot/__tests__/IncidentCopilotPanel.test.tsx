import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IncidentCopilotPanel } from '../IncidentCopilotPanel';
import { incidentCopilotApi } from '../../../services/grcClient';

// Mock the API
jest.mock('../../../services/grcClient', () => ({
  incidentCopilotApi: {
    getStatus: jest.fn(),
    analyze: jest.fn(),
    listAnalyses: jest.fn(),
    getAnalysis: jest.fn(),
  },
}));

const mockGetStatus = incidentCopilotApi.getStatus as jest.Mock;
const mockAnalyze = incidentCopilotApi.analyze as jest.Mock;
const mockListAnalyses = incidentCopilotApi.listAnalyses as jest.Mock;

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  incidentId: '11111111-1111-1111-1111-111111111111',
  incidentNumber: 'INC000001',
};

const mockStatusEnabled = {
  isAiEnabled: true,
  isFeatureEnabled: true,
  providerType: 'LOCAL',
  modelName: null,
  humanApprovalRequired: false,
  isToolsEnabled: true,
  hasServiceNowProvider: true,
  availableTools: ['SERVICENOW_GET_RECORD'],
  lastAnalysis: null,
};

const mockStatusDisabled = {
  isAiEnabled: false,
  isFeatureEnabled: false,
  providerType: null,
  modelName: null,
  humanApprovalRequired: false,
  isToolsEnabled: false,
  hasServiceNowProvider: false,
  availableTools: [],
  lastAnalysis: null,
};

const mockAnalysisResult = {
  analysisId: 'analysis-1',
  incidentId: defaultProps.incidentId,
  status: 'SUCCESS' as const,
  providerType: 'LOCAL',
  modelName: null,
  confidence: 'MEDIUM' as const,
  summary: 'This is a test executive summary of the incident.',
  recommendedActions: [
    { action: 'Escalate to team lead', severity: 'HIGH', category: 'ESCALATION' },
    { action: 'Check runbooks', severity: 'MEDIUM', category: 'INVESTIGATION' },
  ],
  customerUpdateDraft: 'Dear customer, we are working on your issue.',
  proposedTasks: [
    { title: 'Investigate root cause', description: 'Look into logs', priority: 'P1' },
  ],
  similarIncidents: null,
  impactAssessment: 'Impact: HIGH',
  explainability: {
    dataSources: ['LOCAL_INCIDENT', 'SERVICENOW_INCIDENT'],
    assumptions: ['Based on local data only', 'No SN enrichment available'],
    confidence: 'MEDIUM',
    toolCallCount: 2,
    toolKeysUsed: ['SERVICENOW_GET_RECORD'],
  },
  createdAt: '2026-01-01T00:00:00Z',
};

describe('IncidentCopilotPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStatus.mockResolvedValue(mockStatusEnabled);
    mockListAnalyses.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  });

  it('renders the panel with incident number', async () => {
    render(<IncidentCopilotPanel {...defaultProps} />);

    expect(screen.getByText('Incident Copilot')).toBeInTheDocument();
    expect(screen.getByText('INC000001')).toBeInTheDocument();
  });

  it('shows status badges when loaded', async () => {
    render(<IncidentCopilotPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('AI Enabled')).toBeInTheDocument();
    });
    expect(screen.getByText('Copilot Active')).toBeInTheDocument();
    expect(screen.getByText('Tools Enabled')).toBeInTheDocument();
    expect(screen.getByText('ServiceNow Connected')).toBeInTheDocument();
  });

  it('shows disabled badges when AI is disabled', async () => {
    mockGetStatus.mockResolvedValue(mockStatusDisabled);

    render(<IncidentCopilotPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('AI Disabled')).toBeInTheDocument();
    });
    expect(screen.getByText('Copilot Inactive')).toBeInTheDocument();
    expect(screen.getByText('Tools Disabled')).toBeInTheDocument();
  });

  it('shows analyze button', async () => {
    render(<IncidentCopilotPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('copilot-analyze-btn')).toBeInTheDocument();
    });
    expect(screen.getByText('Analyze Incident')).toBeInTheDocument();
  });

  it('renders analysis results after successful analyze', async () => {
    mockAnalyze.mockResolvedValue(mockAnalysisResult);

    render(<IncidentCopilotPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('copilot-analyze-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('copilot-analyze-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('copilot-results')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Executive summary
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText(/test executive summary/i)).toBeInTheDocument();

    // Recommended actions
    expect(screen.getByText(/Next Best Actions/)).toBeInTheDocument();
    expect(screen.getByText('Escalate to team lead')).toBeInTheDocument();
    expect(screen.getByText('Check runbooks')).toBeInTheDocument();

    // Customer update draft
    expect(screen.getByText('Customer Update Draft')).toBeInTheDocument();
    expect(screen.getByText(/Dear customer/)).toBeInTheDocument();

    // Proposed tasks
    expect(screen.getByText(/Proposed Tasks/)).toBeInTheDocument();
    expect(screen.getByText('Investigate root cause')).toBeInTheDocument();
  });

  it('renders explainability drawer with data sources and assumptions', async () => {
    mockAnalyze.mockResolvedValue(mockAnalysisResult);

    render(<IncidentCopilotPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('copilot-analyze-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('copilot-analyze-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('copilot-explainability-toggle')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Open explainability drawer
    fireEvent.click(screen.getByTestId('copilot-explainability-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('copilot-explainability-content')).toBeInTheDocument();
    });

    // Data sources
    expect(screen.getByText('LOCAL_INCIDENT')).toBeInTheDocument();
    expect(screen.getByText('SERVICENOW_INCIDENT')).toBeInTheDocument();

    // Assumptions
    expect(screen.getByText('Based on local data only')).toBeInTheDocument();
  });

  it('shows error state for failed analysis', async () => {
    mockAnalyze.mockResolvedValue({
      ...mockAnalysisResult,
      status: 'FAIL',
      error: 'AI is currently disabled by tenant policy.',
    });

    render(<IncidentCopilotPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('copilot-analyze-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('copilot-analyze-btn'));

    await waitFor(() => {
      expect(screen.getByText(/AI is currently disabled/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows empty state when panel opens without analysis', async () => {
    render(<IncidentCopilotPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Run analysis to get AI-powered insights')).toBeInTheDocument();
    });
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <IncidentCopilotPanel {...defaultProps} open={false} />,
    );

    // MUI Drawer with open=false should not render the panel content visibly
    expect(container.querySelector('[data-testid="copilot-analyze-btn"]')).toBeNull();
  });
});
