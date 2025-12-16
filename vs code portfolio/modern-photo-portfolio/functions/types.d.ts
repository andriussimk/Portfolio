export interface Env {
  ADMIN_TOKEN?: string;
  ADMIN_EMAIL?: string;
  // Cloudflare bindings (defined in wrangler.toml)
  R2_PHOTO_GALLERIES?: any;
  DB?: any;
}
