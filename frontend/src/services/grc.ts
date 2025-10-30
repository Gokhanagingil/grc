import { api, v1, v2 } from '../lib/api';

// ---------- Governance ----------
export async function fetchGovernance(params?: Record<string, any>) {
  const { data } = await api.get(v1('/governance/policies'), { params });
  return data as { items: any[]; total: number; page: number; limit: number };
}

export async function createGovernance(body: {
  title: string;
  description?: string;
  category?: string;
  version?: string;
  status?: string;
  effectiveDate?: string | null;
  reviewDate?: string | null;
}) {
  const { data } = await api.post(v1('/governance/policies'), body);
  return data;
}

export async function updateGovernance(id: string, body: {
  title?: string;
  description?: string;
  category?: string;
  version?: string;
  status?: string;
  effectiveDate?: string | null;
  reviewDate?: string | null;
}) {
  const { data } = await api.patch(v1(`/governance/policies/${id}`), body);
  return data;
}

export async function deleteGovernance(id: string) {
  const { data } = await api.delete(v1(`/governance/policies/${id}`));
  return data;
}

// ---------- Risk ----------
export async function fetchRisks(params?: Record<string, any>) {
  const { data } = await api.get(v1('/risk/risks'), { params });
  return data as { items: any[]; total: number; page: number; limit: number };
}

// (CRUD bağlama ileride)
// export async function createRisk(...) {}
// export async function updateRisk(...) {}
// export async function deleteRisk(...) {}

// ---------- Compliance ----------
export async function fetchRequirements(params?: Record<string, any>) {
  const { data } = await api.get(v1('/compliance/requirements'), { params });
  return data as { items: any[]; total: number; page: number; limit: number };
}

// (CRUD bağlama ileride)
// export async function createRequirement(...) {}
// export async function updateRequirement(...) {}
// export async function deleteRequirement(...) {}

// ---------- Policies (v2) ----------
export async function fetchPolicies(params?: Record<string, any>) {
  const { data } = await api.get(v2('/policies'), { params });
  return data as { items?: any[]; total?: number; page?: number; limit?: number } | any[];
}


