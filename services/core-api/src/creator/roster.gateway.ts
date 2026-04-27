// WO: WO-INIT-001
import { Injectable } from '@nestjs/common';

export interface RosterEntry {
  performerId: string;
  studioId: string;
  contractRef: string;
  status: string;
}

@Injectable()
export class RosterGateway {
  async getRoster(_studioId: string): Promise<RosterEntry[]> {
    // TODO: Implement roster retrieval from studio_contracts
    return [];
  }

  async getPerformerContract(_studioId: string, _performerId: string): Promise<RosterEntry | null> {
    // TODO: Implement contract lookup from studio_contracts
    return null;
  }
}
