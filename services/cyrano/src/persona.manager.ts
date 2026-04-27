// PAYLOAD 5 — Cyrano persona manager
// A creator may have multiple personas; exactly one can be "active-for-session"
// at any given time. Tone and style notes feed into suggestion copy.

import { Injectable, Logger } from '@nestjs/common';
import type { CreatorPersona } from './cyrano.types';

@Injectable()
export class PersonaManager {
  private readonly logger = new Logger(PersonaManager.name);
  // creator_id → persona_id → persona
  private readonly byCreator = new Map<string, Map<string, CreatorPersona>>();
  // session_id → persona_id
  private readonly activeBySession = new Map<string, string>();

  register(persona: CreatorPersona): void {
    let personas = this.byCreator.get(persona.creator_id);
    if (!personas) {
      personas = new Map();
      this.byCreator.set(persona.creator_id, personas);
    }
    personas.set(persona.persona_id, { ...persona });
  }

  activateForSession(args: {
    session_id: string;
    creator_id: string;
    persona_id: string;
  }): CreatorPersona {
    const personas = this.byCreator.get(args.creator_id);
    const persona = personas?.get(args.persona_id);
    if (!persona) {
      throw new Error(
        `PersonaManager: persona ${args.persona_id} not found for creator ${args.creator_id}`,
      );
    }
    if (!persona.active) {
      throw new Error(
        `PersonaManager: persona ${args.persona_id} is not marked active`,
      );
    }
    this.activeBySession.set(args.session_id, args.persona_id);
    this.logger.log('PersonaManager: persona activated for session', {
      session_id: args.session_id,
      creator_id: args.creator_id,
      persona_id: args.persona_id,
    });
    return persona;
  }

  getActiveForSession(sessionId: string, creatorId: string): CreatorPersona | null {
    const personaId = this.activeBySession.get(sessionId);
    if (!personaId) return null;
    return this.byCreator.get(creatorId)?.get(personaId) ?? null;
  }

  listForCreator(creatorId: string): CreatorPersona[] {
    return Array.from(this.byCreator.get(creatorId)?.values() ?? []);
  }

  /** Test seam. */
  reset(): void {
    this.byCreator.clear();
    this.activeBySession.clear();
  }
}
