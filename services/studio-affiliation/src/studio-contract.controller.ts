// services/studio-affiliation/src/studio-contract.controller.ts
// RBAC-STUDIO-001 — contract upload + signing HTTP surface.
// All routes deal with metadata + base64 bytes; binary multipart stays out
// of scope for this MVP and is handled by services/assets in production.

import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { StudioContractService, ContractPublic } from './studio-contract.service';

interface UploadContractDto {
  studio_id: string;
  creator_id: string;
  storage_uri: string;
  /** Base64-encoded document bytes — used for the integrity hash only. */
  document_bytes_b64: string;
  organization_id: string;
  tenant_id: string;
  correlation_id?: string;
}

interface SignContractDto {
  contract_id: string;
  creator_id: string;
  typed_name: string;
  document_bytes_b64: string;
  correlation_id?: string;
}

@Controller('studio-contracts')
export class StudioContractController {
  private readonly logger = new Logger(StudioContractController.name);

  constructor(private readonly contracts: StudioContractService) {}

  @Post('upload')
  async upload(@Body() dto: UploadContractDto): Promise<ContractPublic> {
    this.logger.log('StudioContractController.upload', {
      studio_id: dto.studio_id,
      creator_id: dto.creator_id,
    });
    return this.contracts.upload({
      studio_id: dto.studio_id,
      creator_id: dto.creator_id,
      storage_uri: dto.storage_uri,
      document_bytes: Buffer.from(dto.document_bytes_b64, 'base64'),
      organization_id: dto.organization_id,
      tenant_id: dto.tenant_id,
      correlation_id: dto.correlation_id,
    });
  }

  @Post('sign')
  async sign(@Body() dto: SignContractDto): Promise<ContractPublic> {
    this.logger.log('StudioContractController.sign', {
      contract_id: dto.contract_id,
      creator_id: dto.creator_id,
    });
    return this.contracts.sign({
      contract_id: dto.contract_id,
      creator_id: dto.creator_id,
      typed_name: dto.typed_name,
      document_bytes: Buffer.from(dto.document_bytes_b64, 'base64'),
      correlation_id: dto.correlation_id,
    });
  }

  @Get('studio/:studio_id')
  async listForStudio(@Param('studio_id') studioId: string): Promise<ContractPublic[]> {
    return this.contracts.listByStudio(studioId);
  }
}
