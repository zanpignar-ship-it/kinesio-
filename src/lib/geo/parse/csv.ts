import Papa from 'papaparse';
import { countDecimals } from '../precision';
import type { Issue } from '../types';
import { finalize, type FinalizeOptions, type ParseResult, type RawFeature } from './common';

// x/y follow GIS order (x = easting); the surveying order (y = easting) is detected from the values.
const LAT = ['lat', 'latitude', 'sirina', 'geografska sirina', 'n', 'northing', 'north', 'y'];
const LON = ['lon', 'lng', 'long', 'longitude', 'dolzina', 'geografska dolzina', 'e', 'easting', 'east', 'x'];
const NAME = ['name', 'ime', 'oznaka', 'label', 'naziv'];
const AREA = ['area', 'area_ha', 'povrsina', 'povrsina_ha', 'ha'];

const normalizeHeader = (h: string): string =>
  h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

function pick(row: Record<string, string>, names: string[]): string | undefined {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v.trim() !== '') return v.trim();
  }
  return undefined;
}

const toNumber = (s: string): number => Number(s.replace(/\s/g, '').replace(',', '.'));

export function parseCsv(text: string, opts: FinalizeOptions = {}): ParseResult {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t'],
    transformHeader: normalizeHeader,
  });
  const issues: Issue[] = [];
  const raw: RawFeature[] = [];
  result.data.forEach((row, i) => {
    const latText = pick(row, LAT);
    const lonText = pick(row, LON);
    const lat = latText === undefined ? Number.NaN : toNumber(latText);
    const lon = lonText === undefined ? Number.NaN : toNumber(lonText);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || latText === undefined || lonText === undefined) {
      issues.push({ code: 'PARSE_FAILED', severity: 'error', params: { row: i + 2 } });
      return;
    }
    const properties: Record<string, unknown> = {};
    const name = pick(row, NAME);
    if (name !== undefined) properties.name = name;
    const area = pick(row, AREA);
    if (area !== undefined && Number.isFinite(toNumber(area))) properties.areaHa = toNumber(area);
    const dLat = countDecimals(latText);
    const dLon = countDecimals(lonText);
    raw.push({
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties,
      decimals: { min: Math.min(dLat, dLon), max: Math.max(dLat, dLon) },
    });
  });
  return finalize(raw, null, issues, opts);
}
