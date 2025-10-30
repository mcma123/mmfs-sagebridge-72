export type EntityType = 'Client' | 'CDANT' | 'Reinsurer';

export interface BaseEntity {
  id: string;
  type: EntityType;
  name: string;
  status: 'Active' | 'Inactive';
  currency?: string; // ISO code e.g., 'USD', 'ZAR'
  country?: string;
  address?: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientEntity extends BaseEntity {
  vatNumber?: string;
  creditTermsDays?: number;
  outstanding?: number;
}

export interface CdantEntity extends BaseEntity {
  commissionRate?: number; // percent
  licenseNumber?: string;
  outstanding?: number;
}

export interface ReinsurerEntity extends BaseEntity {
  treatyTerms?: string;
  rating?: string; // e.g., AM Best
  capacity?: number;
  netPosition?: number; // positive/negative
}

export type AnyEntity = ClientEntity | CdantEntity | ReinsurerEntity;

interface StoreShape {
  entities: AnyEntity[];
}

const LS_KEY = 'accounting_entities_store';

function loadStore(): StoreShape {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse entities store', e);
  }
  return { entities: [] };
}

function persist(store: StoreShape) {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

function uuid(): string {
  return 'ent-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

export function listEntities(type?: EntityType): AnyEntity[] {
  const s = loadStore();
  const list = s.entities.slice().reverse();
  return type ? list.filter((e) => e.type === type) : list;
}

export function getEntity(id: string): AnyEntity | undefined {
  const s = loadStore();
  return s.entities.find((e) => e.id === id);
}

export function addEntity(entity: Omit<AnyEntity, 'id' | 'createdAt'>): AnyEntity {
  const s = loadStore();
  const now = new Date().toISOString();
  const newEntity: AnyEntity = { ...entity, id: uuid(), createdAt: now } as AnyEntity;
  s.entities.push(newEntity);
  persist(s);
  return newEntity;
}

export function updateEntity(id: string, patch: Partial<AnyEntity>): AnyEntity {
  const s = loadStore();
  const idx = s.entities.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error('Entity not found');
  const now = new Date().toISOString();
  const updated = { ...s.entities[idx], ...patch, updatedAt: now } as AnyEntity;
  s.entities[idx] = updated;
  persist(s);
  return updated;
}

export function removeEntity(id: string): void {
  const s = loadStore();
  s.entities = s.entities.filter((e) => e.id !== id);
  persist(s);
}