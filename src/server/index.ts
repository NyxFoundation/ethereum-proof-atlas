import raw from '../../data/atlas.json';
import type { AtlasBundle } from '../domain/schema';
import { createApp } from './app';

// Vite's package gate has validated this exact JSON and its canonical digest.
// Do not repeat whole-bundle validation for every HTTP request.
export default createApp(raw as AtlasBundle, undefined, import.meta.env.DEV);
