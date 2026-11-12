import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkDds, groupProducers, submitDdsBody, type DdsInput } from '@/lib/traces/dds';
import { parseFault, parseOverview } from '@/lib/traces/parse';
import { envelope, passwordDigest } from '@/lib/traces/wsse';
import { pick } from '@/lib/traces/xml';

const creds = { username: 'ana.novak', authKey: 'secret-key', clientId: 'eudr-test' };

describe('WS-Security', () => {
  it('PasswordDigest = Base64(SHA-1(nonce + created + key))', () => {
    const nonce = Buffer.from('0123456789abcdef');
    const created = '2026-11-12T10:00:00.000Z';
    const expected = createHash('sha1').update(Buffer.concat([nonce, Buffer.from(created + 'secret-key')])).digest('base64');
    expect(passwordDigest(nonce, created, 'secret-key')).toBe(expected);
  });

  it('builds a single-line envelope with timestamp, token and client id', () => {
    const xml = envelope(creds, '<echo:EudrEchoRequest/>', new Date('2026-11-12T10:00:00Z'), Buffer.from('0123456789abcdef'));
    expect(xml).not.toMatch(/\n/);
    expect(pick(xml, 'Created')).toBe('2026-11-12T10:00:00.000Z');
    expect(pick(xml, 'Expires')).toBe('2026-11-12T10:05:00.000Z');
    expect(pick(xml, 'Username')).toBe('ana.novak');
    expect(pick(xml, 'Nonce')).toBe(Buffer.from('0123456789abcdef').toString('base64'));
    expect(pick(xml, 'WebServiceClientId')).toBe('eudr-test');
    expect(xml).toContain('#PasswordDigest');
    expect(xml).not.toContain('secret-key');
  });
});

const square = { type: 'Polygon' as const, coordinates: [[[14.5, 46.0], [14.502, 46.0], [14.502, 46.002], [14.5, 46.002], [14.5, 46.0]]] };
const input: DdsInput = {
  internalRef: 'S-1 <&>',
  activity: 'EXPORT',
  countryOfActivity: 'SI',
  geoLocationConfidential: false,
  commodities: [{ description: 'Hlodovina smreke', hsCode: '4403', netMassKg: 24000.5, volumeM3: 30, pieces: null, scientificName: 'Picea abies', commonName: 'smreka' }],
  plots: [
    { label: 'Gozd A', geometry: square, producerCountry: 'SI', producerName: 'Janez Novak' },
    { label: 'Gozd B', geometry: { type: 'Point', coordinates: [14.6, 46.1] }, producerCountry: 'SI', producerName: 'Janez Novak', areaHa: 1.5 },
    { label: 'Gozd C', geometry: { type: 'Point', coordinates: [15.6, 45.1] }, producerCountry: 'HR', areaHa: 2 },
  ],
};

describe('SubmitDdsRequest', () => {
  it('maps the shipment to V4 elements', () => {
    const body = submitDdsBody(input);
    expect(pick(body, 'internalReferenceNumber')).toBe('S-1 <&>');
    expect(body).toContain('S-1 &lt;&amp;&gt;');
    expect(pick(body, 'activityType')).toBe('EXPORT');
    expect(pick(body, 'countryOfActivity')).toBe('SI');
    expect(pick(body, 'hsHeading')).toBe('4403');
    expect(pick(body, 'netWeight')).toBe('24000.5');
    expect(pick(body, 'supplementaryUnit')).toBe('30');
    expect(pick(body, 'supplementaryUnitQualifier')).toBe('MTQ');
    expect(pick(body, 'scientificName')).toBe('Picea abies');
    expect(pick(body, 'geoLocationConfidential')).toBe('false');
  });

  it('groups plots into producers with a base64 GeoJSON FeatureCollection each', () => {
    expect(groupProducers(input.plots).map((g) => [g.name, g.country, g.plots.length])).toEqual([
      ['Janez Novak', 'SI', 2],
      [null, 'HR', 1],
    ]);
    const body = submitDdsBody(input);
    const fc = JSON.parse(Buffer.from(pick(body, 'geometryGeojson')!, 'base64').toString('utf8')) as { type: string; features: { properties: Record<string, unknown> }[] };
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.map((f) => f.properties.ProductionPlace)).toEqual(['Gozd A', 'Gozd B']);
    expect(fc.features[1]!.properties.Area).toBe(1.5);
  });

  it('confidential geolocation leaves the GeoJSON out; non-EU operators get no country of activity', () => {
    const body = submitDdsBody({ ...input, geoLocationConfidential: true, countryOfActivity: 'BA', activity: 'IMPORT' });
    expect(body).not.toContain('geometryGeojson');
    expect(body).not.toContain('countryOfActivity');
  });

  it('checks the rules the Information System enforces', () => {
    expect(checkDds(input)).toEqual([]);
    const bad = { ...input, plots: [], commodities: [{ ...input.commodities[0]!, commonName: null, netMassKg: null, hsCode: '44a' }] };
    expect(checkDds(bad).sort()).toEqual(['hsCode', 'netMass', 'noPlots', 'speciesNames']);
  });
});

describe('responses (samples from the API documentation)', () => {
  it('reads the overview of getDds', () => {
    const xml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns5:GetDdsResponse xmlns:ns3="c" xmlns:ns5="d"><ns5:ddsOverviewList><ns3:uuid>071874bd-8c62-4cac-8eb6-b2fbe003410c</ns3:uuid><ns3:internalReferenceNumber>26BEDWNW9JD1TN</ns3:internalReferenceNumber><ns3:referenceNumber>26BE7XTVCZAQ2S</ns3:referenceNumber><ns3:referenceNumberInfo>Assigned</ns3:referenceNumberInfo><ns3:verificationNumber>SFFCB4Y3</ns3:verificationNumber><ns3:status>AVAILABLE</ns3:status></ns5:ddsOverviewList></ns5:GetDdsResponse></S:Body></S:Envelope>`;
    expect(parseOverview(xml)).toEqual([
      { uuid: '071874bd-8c62-4cac-8eb6-b2fbe003410c', internalReferenceNumber: '26BEDWNW9JD1TN', referenceNumber: '26BE7XTVCZAQ2S', referenceNumberInfo: 'Assigned', verificationNumber: 'SFFCB4Y3', status: 'AVAILABLE', rejectionReason: null, communication: null },
    ]);
    expect(parseFault(xml)).toBeNull();
  });

  it('reads SOAP faults', () => {
    const fault = `<soapenv:Envelope xmlns:soapenv="x"><soapenv:Body><soapenv:Fault><faultcode>soapenv:Server</faultcode><faultstring>EudrEchoServiceFault</faultstring><detail><echo:EudrEchoServiceFault xmlns:echo="e"><echo:errorMessage>Authentication failed</echo:errorMessage></echo:EudrEchoServiceFault></detail></soapenv:Fault></soapenv:Body></soapenv:Envelope>`;
    expect(parseFault(fault)).toEqual({ code: 'EudrEchoServiceFault', message: 'Authentication failed' });
    expect(parseFault('<env:Fault><faultcode>env:Server</faultcode><faultstring>InternalSystemException</faultstring></env:Fault>')).toEqual({ code: 'InternalSystemException', message: 'InternalSystemException' });
  });
});

import { vi } from 'vitest';
vi.mock('server-only', () => ({}));

describe('status from TRACES', () => {
  it('stores the numbers once the statement is available, and marks rejections', async () => {
    const { shipmentUpdateFromOverview, tracesCheckDue } = await import('@/lib/traces/service');
    const base = { uuid: 'u', internalReferenceNumber: 'S-1', referenceNumberInfo: null, rejectionReason: null, communication: null };
    expect(shipmentUpdateFromOverview({ ...base, status: 'AVAILABLE', referenceNumber: '26SI7XTVCZAQ2S', verificationNumber: 'SFFCB4Y3' }, 'ready')).toMatchObject({
      status: 'submitted', dds_reference_no: '26SI7XTVCZAQ2S', dds_verification_no: 'SFFCB4Y3', traces_status: 'AVAILABLE',
    });
    expect(shipmentUpdateFromOverview({ ...base, status: 'SUBMITTED', referenceNumber: null, verificationNumber: null, referenceNumberInfo: 'Under system analysis' }, 'ready')).toMatchObject({
      traces_status: 'SUBMITTED', traces_message: 'Under system analysis',
    });
    expect(shipmentUpdateFromOverview({ ...base, status: 'SUBMITTED', referenceNumber: null, verificationNumber: null }, 'ready').status).toBeUndefined();
    expect(shipmentUpdateFromOverview({ ...base, status: 'REJECTED', referenceNumber: null, verificationNumber: null, rejectionReason: 'Invalid geometry' }, 'ready')).toMatchObject({ status: 'rejected', traces_message: 'Invalid geometry' });

    const now = Date.parse('2026-11-12T12:00:00Z');
    expect(tracesCheckDue({ traces_status: 'SUBMITTED', traces_checked_at: '2026-11-12T11:30:00Z' }, now)).toBe(false);
    expect(tracesCheckDue({ traces_status: 'SUBMITTED', traces_checked_at: '2026-11-12T10:30:00Z' }, now)).toBe(true);
    expect(tracesCheckDue({ traces_status: 'AVAILABLE', traces_checked_at: null }, now)).toBe(false);
  });
});
