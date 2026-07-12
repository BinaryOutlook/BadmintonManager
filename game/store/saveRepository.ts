import { z } from "zod";
import {
  persistedSaveSchema,
  validateImportedSaveText,
  type PersistedSave
} from "./save";

export const SAVE_REPOSITORY_PREFIX = "badminton-manager-saves";
export const ACTIVE_SAVE_SLOT_KEY = `${SAVE_REPOSITORY_PREFIX}:active`;
export const LEGACY_SAVE_KEY = "badminton-manager-save";

const STORAGE_VERSION = 1 as const;
const MAX_BACKUPS_PER_SLOT = 2;
const identifierSchema = z.string().min(1).regex(/^[A-Za-z0-9_-]+$/);

export const saveSlotEnvelopeSchema = z.object({
  storageVersion: z.literal(STORAGE_VERSION),
  slotId: identifierSchema,
  name: z.string().trim().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastPlayedAt: z.string().min(1),
  archivedAt: z.string().min(1).nullable(),
  revision: z.number().int().positive(),
  save: persistedSaveSchema
});

export const quarantinedSaveSlotSchema = z.object({
  storageVersion: z.literal(STORAGE_VERSION),
  slotId: z.string().min(1),
  quarantinedAt: z.string().min(1),
  reason: z.string().min(1),
  originalRaw: z.string()
});

export type SaveSlotEnvelope = z.infer<typeof saveSlotEnvelopeSchema>;
export type QuarantinedSaveSlot = z.infer<typeof quarantinedSaveSlotSchema>;

export interface SaveRepositoryStorage {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveRepositoryDependencies {
  storage: SaveRepositoryStorage;
  clock?: () => string;
  idFactory?: () => string;
}

export interface CreateSaveSlotInput {
  name: string;
  save: PersistedSave;
  slotId?: string;
  activate?: boolean;
}

export interface UpdateSaveSlotOptions {
  name?: string;
  activate?: boolean;
}

export interface DuplicateSaveSlotOptions {
  name?: string;
  activate?: boolean;
}

export type LegacySaveMigrationResult =
  | { status: "none" }
  | { status: "invalid"; message: string }
  | { status: "migrated"; slot: SaveSlotEnvelope; reusedExistingSlot: boolean }
  | { status: "failed"; message: string };

export class SaveRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveRepositoryError";
  }
}

function defaultClock() {
  return new Date().toISOString();
}

function defaultIdFactory() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function slotKey(slotId: string) {
  return `${SAVE_REPOSITORY_PREFIX}:slot:${slotId}`;
}

function backupPrefix(slotId: string) {
  return `${SAVE_REPOSITORY_PREFIX}:backup:${slotId}:`;
}

function backupKey(slotId: string, revision: number) {
  return `${backupPrefix(slotId)}${revision}`;
}

function quarantinePrefix(slotId: string) {
  return `${SAVE_REPOSITORY_PREFIX}:quarantine:${slotId}:`;
}

function serialize(value: unknown) {
  return JSON.stringify(value);
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}

export class SaveRepository {
  private readonly storage: SaveRepositoryStorage;
  private readonly clock: () => string;
  private readonly idFactory: () => string;

  constructor({ storage, clock = defaultClock, idFactory = defaultIdFactory }: SaveRepositoryDependencies) {
    this.storage = storage;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  createSlot({ name, save, slotId = this.nextIdentifier(), activate = true }: CreateSaveSlotInput) {
    const validatedSlotId = identifierSchema.parse(slotId);
    if (this.storage.getItem(slotKey(validatedSlotId)) !== null) {
      throw new SaveRepositoryError(`Save slot ${validatedSlotId} already exists.`);
    }

    const now = this.clock();
    const envelope = saveSlotEnvelopeSchema.parse({
      storageVersion: STORAGE_VERSION,
      slotId: validatedSlotId,
      name,
      createdAt: now,
      updatedAt: now,
      lastPlayedAt: now,
      archivedAt: null,
      revision: 1,
      save
    });

    this.writeEnvelope(envelope, null);
    if (activate) {
      this.setActiveSlot(envelope.slotId);
    }

    return envelope;
  }

  updateSlot(slotId: string, save: PersistedSave, options: UpdateSaveSlotOptions = {}) {
    const current = this.readSlot(slotId);
    if (!current) {
      throw new SaveRepositoryError(`Save slot ${slotId} does not exist or could not be read.`);
    }
    const previousRaw = this.storage.getItem(slotKey(current.slotId));
    if (previousRaw === null) {
      throw new SaveRepositoryError(`Save slot ${slotId} disappeared before it could be updated.`);
    }

    const now = this.clock();
    const envelope = saveSlotEnvelopeSchema.parse({
      ...current,
      name: options.name ?? current.name,
      updatedAt: now,
      lastPlayedAt: now,
      archivedAt: null,
      revision: current.revision + 1,
      save
    });

    this.writeEnvelope(envelope, previousRaw);
    if (options.activate ?? true) {
      this.setActiveSlot(slotId);
    }

    return envelope;
  }

  duplicateSlot(slotId: string, options: DuplicateSaveSlotOptions = {}) {
    const source = this.requireSlot(slotId);

    return this.createSlot({
      name: options.name?.trim() || `${source.name} Copy`,
      save: source.save,
      activate: options.activate ?? true
    });
  }

  deleteSlot(slotId: string) {
    const validatedSlotId = identifierSchema.parse(slotId);
    const key = slotKey(validatedSlotId);

    if (this.storage.getItem(key) === null) {
      throw new SaveRepositoryError(`Save slot ${validatedSlotId} does not exist.`);
    }

    if (this.getActiveSlotId() === validatedSlotId) {
      this.setActiveSlot(null);
    }

    const ownedKeys = this.keys().filter(
      (candidate) => candidate === key || candidate.startsWith(backupPrefix(validatedSlotId))
    );

    for (const ownedKey of ownedKeys) {
      this.storage.removeItem(ownedKey);
      if (this.storage.getItem(ownedKey) !== null) {
        throw new SaveRepositoryError(`Save slot data could not be deleted from ${ownedKey}.`);
      }
    }
  }

  renameSlot(slotId: string, name: string) {
    const current = this.requireSlot(slotId);
    const previousRaw = this.storage.getItem(slotKey(current.slotId));
    if (previousRaw === null) {
      throw new SaveRepositoryError(`Save slot ${slotId} disappeared before it could be renamed.`);
    }
    const envelope = saveSlotEnvelopeSchema.parse({
      ...current,
      name,
      updatedAt: this.clock(),
      revision: current.revision + 1
    });
    this.writeEnvelope(envelope, previousRaw);
    return envelope;
  }

  setSlotArchived(slotId: string, archived: boolean) {
    const current = this.requireSlot(slotId);
    const previousRaw = this.storage.getItem(slotKey(current.slotId));
    if (previousRaw === null) {
      throw new SaveRepositoryError(`Save slot ${slotId} disappeared before it could be archived.`);
    }
    const now = this.clock();
    const envelope = saveSlotEnvelopeSchema.parse({
      ...current,
      updatedAt: now,
      archivedAt: archived ? now : null,
      revision: current.revision + 1
    });
    this.writeEnvelope(envelope, previousRaw);

    if (archived && this.getActiveSlotId() === slotId) {
      this.setActiveSlot(null);
    }

    return envelope;
  }

  readSlot(slotId: string): SaveSlotEnvelope | null {
    const validatedSlotId = identifierSchema.safeParse(slotId);
    if (!validatedSlotId.success) {
      return null;
    }

    const key = slotKey(validatedSlotId.data);
    const raw = this.storage.getItem(key);
    if (raw === null) {
      return null;
    }

    let json: unknown;
    try {
      json = parseJson(raw);
    } catch {
      this.quarantineSlot(validatedSlotId.data, raw, "The slot did not contain valid JSON.");
      return null;
    }

    const parsed = saveSlotEnvelopeSchema.safeParse(json);
    if (!parsed.success) {
      this.quarantineSlot(validatedSlotId.data, raw, "The slot envelope or gameplay save failed validation.");
      return null;
    }
    if (parsed.data.slotId !== validatedSlotId.data) {
      this.quarantineSlot(validatedSlotId.data, raw, "The slot key and envelope identity did not match.");
      return null;
    }
    return parsed.data;
  }

  listSlots(options: { includeArchived?: boolean } = {}) {
    const includeArchived = options.includeArchived ?? true;
    const slots = this.keys().flatMap((key) => {
      const prefix = `${SAVE_REPOSITORY_PREFIX}:slot:`;
      if (!key.startsWith(prefix)) {
        return [];
      }
      const slot = this.readSlot(key.slice(prefix.length));
      return slot && (includeArchived || slot.archivedAt === null) ? [slot] : [];
    });

    return slots.sort(
      (left, right) =>
        right.lastPlayedAt.localeCompare(left.lastPlayedAt) || left.name.localeCompare(right.name)
    );
  }

  listBackups(slotId: string) {
    const prefix = backupPrefix(identifierSchema.parse(slotId));
    return this.keys()
      .filter((key) => key.startsWith(prefix))
      .flatMap((key) => {
        const raw = this.storage.getItem(key);
        if (raw === null) {
          return [];
        }
        try {
          const parsed = saveSlotEnvelopeSchema.safeParse(parseJson(raw));
          return parsed.success ? [parsed.data] : [];
        } catch {
          return [];
        }
      })
      .sort((left, right) => right.revision - left.revision);
  }

  listQuarantinedSlots(slotId?: string) {
    const prefix = slotId
      ? quarantinePrefix(identifierSchema.parse(slotId))
      : `${SAVE_REPOSITORY_PREFIX}:quarantine:`;
    return this.keys()
      .filter((key) => key.startsWith(prefix))
      .flatMap((key) => {
        const raw = this.storage.getItem(key);
        if (raw === null) {
          return [];
        }
        try {
          const parsed = quarantinedSaveSlotSchema.safeParse(parseJson(raw));
          return parsed.success ? [{ key, record: parsed.data }] : [];
        } catch {
          return [];
        }
      })
      .sort((left, right) => right.record.quarantinedAt.localeCompare(left.record.quarantinedAt));
  }

  getActiveSlotId() {
    const value = this.storage.getItem(ACTIVE_SAVE_SLOT_KEY);
    return value !== null && identifierSchema.safeParse(value).success ? value : null;
  }

  getActiveSlot() {
    const slotId = this.getActiveSlotId();
    return slotId ? this.readSlot(slotId) : null;
  }

  setActiveSlot(slotId: string | null) {
    if (slotId === null) {
      this.storage.removeItem(ACTIVE_SAVE_SLOT_KEY);
      if (this.storage.getItem(ACTIVE_SAVE_SLOT_KEY) !== null) {
        throw new SaveRepositoryError("The active save pointer could not be cleared.");
      }
      return;
    }

    const validatedSlotId = identifierSchema.parse(slotId);
    if (!this.readSlot(validatedSlotId)) {
      throw new SaveRepositoryError(`Save slot ${validatedSlotId} cannot become active because it is unavailable.`);
    }
    this.verifiedSet(ACTIVE_SAVE_SLOT_KEY, validatedSlotId);
  }

  migrateLegacySave(): LegacySaveMigrationResult {
    const raw = this.storage.getItem(LEGACY_SAVE_KEY);
    if (raw === null) {
      return { status: "none" };
    }

    const validation = validateImportedSaveText(raw);
    if (!validation.ok) {
      return { status: "invalid", message: validation.message };
    }

    try {
      const canonicalSave = serialize(validation.save);
      const existing = this.listSlots().find((slot) => serialize(slot.save) === canonicalSave);
      const slot =
        existing ??
        this.createSlot({
          name: "Recovered Legacy Career",
          save: validation.save,
          activate: false
        });

      // The legacy source is intentionally retained until both durable slot data and
      // the active pointer have survived a readback check.
      const verifiedSlot = this.readSlot(slot.slotId);
      if (!verifiedSlot) {
        return { status: "failed", message: "The migrated slot could not be verified." };
      }
      this.setActiveSlot(slot.slotId);
      if (this.getActiveSlotId() !== slot.slotId) {
        return { status: "failed", message: "The migrated slot could not become active." };
      }

      this.storage.removeItem(LEGACY_SAVE_KEY);
      if (this.storage.getItem(LEGACY_SAVE_KEY) !== null) {
        return { status: "failed", message: "The legacy save was copied safely but could not be removed." };
      }

      return { status: "migrated", slot: verifiedSlot, reusedExistingSlot: Boolean(existing) };
    } catch (error) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "The legacy save could not be migrated."
      };
    }
  }

  private requireSlot(slotId: string) {
    const slot = this.readSlot(slotId);
    if (!slot) {
      throw new SaveRepositoryError(`Save slot ${slotId} does not exist or could not be read.`);
    }
    return slot;
  }

  private writeEnvelope(envelope: SaveSlotEnvelope, previousRaw: string | null) {
    const key = slotKey(envelope.slotId);
    if (previousRaw !== null) {
      const previous = saveSlotEnvelopeSchema.safeParse(parseJson(previousRaw));
      if (!previous.success || previous.data.slotId !== envelope.slotId) {
        throw new SaveRepositoryError("A valid current slot is required before it can be overwritten.");
      }
      this.verifiedSet(backupKey(envelope.slotId, previous.data.revision), previousRaw);
    }

    const nextRaw = serialize(envelope);
    try {
      this.verifiedSet(key, nextRaw);
    } catch (error) {
      if (previousRaw !== null) {
        try {
          this.verifiedSet(key, previousRaw);
        } catch {
          // The original write error remains the most useful failure for the caller.
        }
      }
      throw error;
    }

    this.pruneBackups(envelope.slotId);
  }

  private pruneBackups(slotId: string) {
    const prefix = backupPrefix(slotId);
    const keys = this.keys()
      .filter((key) => key.startsWith(prefix))
      .map((key) => ({ key, revision: Number(key.slice(prefix.length)) }))
      .filter((entry) => Number.isInteger(entry.revision))
      .sort((left, right) => right.revision - left.revision);

    for (const entry of keys.slice(MAX_BACKUPS_PER_SLOT)) {
      this.storage.removeItem(entry.key);
    }
  }

  private quarantineSlot(slotId: string, originalRaw: string, reason: string) {
    let key = `${quarantinePrefix(slotId)}${this.nextIdentifier()}`;
    let suffix = 2;
    while (this.storage.getItem(key) !== null) {
      key = `${quarantinePrefix(slotId)}${this.nextIdentifier()}-${suffix}`;
      suffix += 1;
    }

    const record = quarantinedSaveSlotSchema.parse({
      storageVersion: STORAGE_VERSION,
      slotId,
      quarantinedAt: this.clock(),
      reason,
      originalRaw
    });
    this.verifiedSet(key, serialize(record));

    this.storage.removeItem(slotKey(slotId));
    if (this.storage.getItem(slotKey(slotId)) !== null) {
      throw new SaveRepositoryError(`Unreadable save slot ${slotId} was preserved but could not be isolated.`);
    }
  }

  private verifiedSet(key: string, value: string) {
    this.storage.setItem(key, value);
    if (this.storage.getItem(key) !== value) {
      throw new SaveRepositoryError(`Storage verification failed for ${key}.`);
    }
  }

  private nextIdentifier() {
    return identifierSchema.parse(this.idFactory());
  }

  private keys() {
    const keys: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key !== null) {
        keys.push(key);
      }
    }
    return keys;
  }
}

export function createSaveRepository(dependencies: SaveRepositoryDependencies) {
  return new SaveRepository(dependencies);
}
