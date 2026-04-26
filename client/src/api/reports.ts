import apiClient from './client';

export async function downloadContractPdf(contractId: string): Promise<Blob> {
  const res = await apiClient.get(`/reports/contracts/${contractId}/pdf`, {
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadProjectAuditTrail(projectId: string): Promise<Blob> {
  const res = await apiClient.get(`/reports/projects/${projectId}/audit-trail`, {
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadContractAuditTrail(contractId: string): Promise<Blob> {
  const res = await apiClient.get(`/reports/contracts/${contractId}/audit-trail`, {
    responseType: 'blob',
  });
  return res.data;
}

export async function verifyAuditChain(from?: number, to?: number) {
  const params: Record<string, number> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await apiClient.get('/reports/audit-chain/verify', { params });
  return res.data as { valid: boolean; brokenAtSequence?: number; totalChecked: number };
}

export function triggerPdfDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
