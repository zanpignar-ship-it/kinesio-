import { pick, pickAll } from './xml';

export type TracesFault = { code: string; message: string };

export type DdsOverview = {
  uuid: string;
  internalReferenceNumber: string | null;
  referenceNumber: string | null;
  referenceNumberInfo: string | null;
  verificationNumber: string | null;
  status: string;
  rejectionReason: string | null;
  communication: string | null;
};

/** SOAP fault → code (fault string or business error id) and the most specific message the service gave. */
export function parseFault(xml: string): TracesFault | null {
  if (!/<(?:[\w-]+:)?Fault[\s>]/.test(xml)) return null;
  const faultstring = pick(xml, 'faultstring') ?? 'Fault';
  const message = pick(xml, 'errorMessage') ?? pick(xml, 'message') ?? pick(xml, 'reason') ?? pick(xml, 'faultstring') ?? '';
  const id = pick(xml, 'id') ?? pick(xml, 'code') ?? pick(xml, 'errorCode');
  return { code: id ?? faultstring, message };
}

export function parseOverview(xml: string): DdsOverview[] {
  return pickAll(xml, 'ddsOverviewList').map((o) => ({
    uuid: pick(o, 'uuid') ?? '',
    internalReferenceNumber: pick(o, 'internalReferenceNumber'),
    referenceNumber: pick(o, 'referenceNumber'),
    referenceNumberInfo: pick(o, 'referenceNumberInfo'),
    verificationNumber: pick(o, 'verificationNumber'),
    status: pick(o, 'status') ?? '',
    rejectionReason: pick(o, 'rejectionReason'),
    communication: pick(o, 'content'),
  }));
}
