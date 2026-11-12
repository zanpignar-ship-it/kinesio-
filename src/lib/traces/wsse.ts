import { createHash, randomBytes } from 'node:crypto';
import { esc } from './xml';

export const NS = {
  soapenv: 'http://schemas.xmlsoap.org/soap/envelope/',
  wsse: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
  wsu: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
  base: 'http://ec.europa.eu/sanco/tracesnt/base/v4',
  dds: 'http://ec.europa.eu/tracesnt/certificate/eudr/due-diligence-statement/v4',
  common: 'http://ec.europa.eu/tracesnt/certificate/eudr/common/v4',
  echo: 'http://ec.europa.eu/tracesnt/eudr/echo',
} as const;

const PASSWORD_DIGEST = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest';
const BASE64_BINARY = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary';

export type TracesCredentials = { username: string; authKey: string; clientId: string };

/** WS-Security PasswordDigest = Base64(SHA-1(nonce bytes + created + password)); single line, no wrapping. */
export function passwordDigest(nonce: Buffer, created: string, authKey: string): string {
  return createHash('sha1').update(Buffer.concat([nonce, Buffer.from(created, 'utf8'), Buffer.from(authKey, 'utf8')])).digest('base64');
}

/** SOAP header: Timestamp (5 minutes), UsernameToken with PasswordDigest, and the WebServiceClientId. */
export function securityHeader(creds: TracesCredentials, now: Date = new Date(), nonce: Buffer = randomBytes(16)): string {
  const created = now.toISOString();
  const expires = new Date(now.getTime() + 5 * 60_000).toISOString();
  return (
    `<soapenv:Header>` +
    `<wsse:Security xmlns:wsse="${NS.wsse}" xmlns:wsu="${NS.wsu}">` +
    `<wsu:Timestamp wsu:Id="TS-1"><wsu:Created>${created}</wsu:Created><wsu:Expires>${expires}</wsu:Expires></wsu:Timestamp>` +
    `<wsse:UsernameToken wsu:Id="UT-1">` +
    `<wsse:Username>${esc(creds.username)}</wsse:Username>` +
    `<wsse:Password Type="${PASSWORD_DIGEST}">${passwordDigest(nonce, created, creds.authKey)}</wsse:Password>` +
    `<wsse:Nonce EncodingType="${BASE64_BINARY}">${nonce.toString('base64')}</wsse:Nonce>` +
    `<wsu:Created>${created}</wsu:Created>` +
    `</wsse:UsernameToken>` +
    `</wsse:Security>` +
    `<base:WebServiceClientId>${esc(creds.clientId)}</base:WebServiceClientId>` +
    `</soapenv:Header>`
  );
}

/** Full SOAP 1.1 envelope (no pretty printing: whitespace inside the security values breaks authentication). */
export function envelope(creds: TracesCredentials, body: string, now?: Date, nonce?: Buffer): string {
  return (
    `<soapenv:Envelope xmlns:soapenv="${NS.soapenv}" xmlns:base="${NS.base}" xmlns:dds="${NS.dds}" xmlns:eudrCommon="${NS.common}" xmlns:echo="${NS.echo}">` +
    securityHeader(creds, now, nonce) +
    `<soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`
  );
}
