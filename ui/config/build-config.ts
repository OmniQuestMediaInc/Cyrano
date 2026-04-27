// PAYLOAD 7 — Environment-specific build configuration.
// Centralizes the differences between local, staging, and production
// deployments. Pure data — runtime callers MUST pass an env value through
// resolveBuildConfig() rather than reading process.env directly so the UI
// stays testable.

export type DeployEnv = 'local' | 'staging' | 'production';

export interface BuildConfig {
  env: DeployEnv;
  api_base_url: string;
  websocket_base_url: string;
  enable_telemetry: boolean;
  enable_dev_overlays: boolean;
  enable_admin_routes: boolean;
  log_level: 'debug' | 'info' | 'warn' | 'error';
  allowed_origins: readonly string[];
  feature_flags: Readonly<Record<string, boolean>>;
}

const LOCAL_CONFIG: BuildConfig = {
  env: 'local',
  api_base_url: 'http://localhost:3000',
  websocket_base_url: 'ws://localhost:3000',
  enable_telemetry: false,
  enable_dev_overlays: true,
  enable_admin_routes: true,
  log_level: 'debug',
  allowed_origins: ['http://localhost:3000', 'http://localhost:5173'],
  feature_flags: {
    diamond_concierge_command_center: true,
    creator_control_zone: true,
    cyrano_whisper_panel: true,
    safety_net_offers: true,
    welfare_guardian_panel: true,
    audit_chain_viewer: true,
  },
};

const STAGING_CONFIG: BuildConfig = {
  env: 'staging',
  api_base_url: 'https://staging.chatnow.zone',
  websocket_base_url: 'wss://staging.chatnow.zone',
  enable_telemetry: true,
  enable_dev_overlays: true,
  enable_admin_routes: true,
  log_level: 'info',
  allowed_origins: ['https://staging.chatnow.zone'],
  feature_flags: {
    diamond_concierge_command_center: true,
    creator_control_zone: true,
    cyrano_whisper_panel: true,
    safety_net_offers: true,
    welfare_guardian_panel: true,
    audit_chain_viewer: true,
  },
};

const PRODUCTION_CONFIG: BuildConfig = {
  env: 'production',
  api_base_url: 'https://chatnow.zone',
  websocket_base_url: 'wss://chatnow.zone',
  enable_telemetry: true,
  enable_dev_overlays: false,
  enable_admin_routes: true,
  log_level: 'warn',
  allowed_origins: ['https://chatnow.zone'],
  feature_flags: {
    diamond_concierge_command_center: true,
    creator_control_zone: true,
    cyrano_whisper_panel: true,
    safety_net_offers: true,
    welfare_guardian_panel: true,
    audit_chain_viewer: true,
  },
};

export function resolveBuildConfig(env: DeployEnv): BuildConfig {
  switch (env) {
    case 'local':
      return LOCAL_CONFIG;
    case 'staging':
      return STAGING_CONFIG;
    case 'production':
      return PRODUCTION_CONFIG;
  }
}

/**
 * Reads NODE_ENV / DEPLOY_ENV at module load for callers that genuinely need
 * an "ambient" config. Tests should call resolveBuildConfig() directly with
 * the env they want to verify.
 */
export function resolveBuildConfigFromEnv(env: NodeJS.ProcessEnv = process.env): BuildConfig {
  const explicit = (env.DEPLOY_ENV ?? '').toLowerCase();
  if (explicit === 'local' || explicit === 'staging' || explicit === 'production') {
    return resolveBuildConfig(explicit);
  }
  if (env.NODE_ENV === 'production') return PRODUCTION_CONFIG;
  return LOCAL_CONFIG;
}
