import { emitBurst, type BurstSpec } from '../components/overlays/ParticleField';

/**
 * Access to the shared particle field. The pool lives at module scope in
 * ParticleField (there is exactly one mounted <ParticleField/>), so this hook is
 * a thin, allocation-free wrapper rather than a context — any component can fire
 * a burst at a resolved anchor rect.
 */
export function useParticles(): { emit: (spec: BurstSpec) => void } {
  return { emit: emitBurst };
}
