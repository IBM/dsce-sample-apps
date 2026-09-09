// ui/src/api/client.ts – Axios client bound to backend API
import axios from 'axios';
import type {
  RiskEvent, MitigationOption, RAGResponse, WorkPackage,
  MaterialRequirement, Shipment, ApprovalRequest,
  ResilienceProfileResponse, AvlStatusResponse,
  PortStatusResponse, SupplierResilienceStatus,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Propagate correlation ID if available
api.interceptors.request.use((config) => {
  const cid = sessionStorage.getItem('correlationId');
  if (cid) config.headers['x-correlation-id'] = cid;
  return config;
});

api.interceptors.response.use((resp) => {
  const cid = resp.headers['x-correlation-id'];
  if (cid) sessionStorage.setItem('correlationId', cid);
  return resp;
});

// ── Core read tools ──────────────────────────────────────────────────────────
export const getRisks = () =>
  api.get<{ risks: RiskEvent[]; total: number }>('/risks').then(r => r.data);

export const getRisk = (riskId: string) =>
  api.get<{ risk: RiskEvent }>(`/risks/${riskId}`).then(r => r.data.risk);

export const getRiskOptions = (riskId: string) =>
  api.get<{ ranked_options: MitigationOption[]; near_equivalent_top_two: boolean }>(
    `/risks/${riskId}/options`
  ).then(r => r.data);

export const getShipment = (shipmentId: string) =>
  api.get<{ shipment: Shipment }>(`/shipments/${shipmentId}`).then(r => r.data.shipment);

export const getWorkPackage = (wpId: string) =>
  api.get<{ work_package: WorkPackage; requirements: MaterialRequirement[] }>(
    `/work-packages/${wpId}`
  ).then(r => r.data);

export const retrieveKnowledge = (query: string, filters: Record<string, unknown> = {}) =>
  api.post<RAGResponse>('/knowledge/retrieve', { query, filters, top_k: 5 }).then(r => r.data);

// ── Supply chain resilience read tools ──────────────────────────────────────
export const getResilienceProfile = (workPackageId: string, materialId: string) =>
  api.get<ResilienceProfileResponse>('/resilience/profile', {
    params: { work_package_id: workPackageId, material_id: materialId },
  }).then(r => r.data);

export const getAvlStatus = (materialId: string) =>
  api.get<AvlStatusResponse>('/resilience/avl', {
    params: { material_id: materialId },
  }).then(r => r.data);

export const getPortStatus = (portCode: string, materialId?: string) =>
  api.get<PortStatusResponse>('/resilience/port-status', {
    params: { port_code: portCode, ...(materialId ? { material_id: materialId } : {}) },
  }).then(r => r.data);

export const getSupplierResilienceStatus = (supplierId: string, materialId?: string) =>
  api.get<SupplierResilienceStatus>('/resilience/supplier-status', {
    params: { supplier_id: supplierId, ...(materialId ? { material_id: materialId } : {}) },
  }).then(r => r.data);

// ── Write tools ──────────────────────────────────────────────────────────────
export const requestApproval = (riskId: string, optionId: string, summary: string) =>
  api.post<ApprovalRequest>('/actions/approval-requests', {
    risk_id: riskId,
    option_id: optionId,
    recommendation_summary: summary,
  }).then(r => r.data);

export const approveRequest = (approvalId: string, approver: string) =>
  api.post<ApprovalRequest>(`/actions/approval-requests/${approvalId}/approve`, {
    approver,
  }).then(r => r.data);

export const rejectRequest = (approvalId: string, approver: string) =>
  api.post<ApprovalRequest>(`/actions/approval-requests/${approvalId}/reject`, {
    approver,
  }).then(r => r.data);

export const executeTransfer = (payload: {
  approval_request_id: string;
  risk_id: string;
  option_id: string;
  source_location_id: string;
  destination_location_id: string;
  material_id: string;
  quantity: number;
}) => api.post<{ transfer_request_id: string; status: string }>(
  '/actions/inventory-transfer', payload
).then(r => r.data);

export const executeExpedite = (payload: {
  approval_request_id: string;
  risk_id: string;
  option_id: string;
  shipment_id: string;
  requested_eta: string;
}) => api.post<{ expedite_request_id: string; status: string }>(
  '/actions/supplier-expedite', payload
).then(r => r.data);

export const markMitigated = (payload: {
  approval_request_id: string;
  risk_id: string;
  option_id: string;
}) => api.post<{ risk_id: string; status: string }>(
  '/actions/mark-mitigated', payload
).then(r => r.data);

// ── Demo helpers ─────────────────────────────────────────────────────────────
export const demoClearAndSimulate = async () => {
  await api.post('/demo/reset');
  return api.post<{ risk_detected: boolean; risk_id?: string; severity?: string }>(
    '/demo/simulate-delay',
    { shipment_id: 'SHP-90017', requirement_id: 'MR-7781' }
  ).then(r => r.data);
};

export const demoReset = () => api.post('/demo/reset').then(r => r.data);

export const demoPopulate = () =>
  api.post<{ populated: boolean; risk_ids: string[]; count: number }>(
    '/demo/populate'
  ).then(r => r.data);
