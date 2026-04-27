export interface TipTransaction {
  userId: string;
  creatorId: string;
  correlationId: string;
  tokenAmount: number;
  isVIP?: boolean;
}
