/**
 * PM2 ecosystem config for hobby-track.
 *
 * Must be .cjs because the root package.json has "type": "module".
 *
 * First deploy:
 *   pm2 start ecosystem.config.cjs --env production
 *
 * Subsequent deploys (zero-downtime reload):
 *   pm2 reload ecosystem.config.cjs --env production --update-env
 *
 * Logs:
 *   pm2 logs hobby-track
 *
 * Save process list so PM2 restarts it on reboot:
 *   pm2 save
 *   pm2 startup   ← follow the printed instructions
 */

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'hobby-track',

      // Compiled entry point (apps/api/dist/server.js)
      script: path.join(__dirname, 'apps', 'api', 'dist', 'server.js'),

      // CWD is apps/api/ so --env-file=.env resolves to apps/api/.env
      cwd: path.join(__dirname, 'apps', 'api'),

      // Load secrets from apps/api/.env.
      // NODE_ENV and PORT are set via env_production below, which takes
      // precedence over the .env file (Node --env-file does not override
      // vars already present in the environment).
      node_args: '--env-file=.env',

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      // Production environment overrides
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },

      // Log files (relative to repo root — create the logs/ dir on the VPS)
      out_file: path.join(__dirname, 'logs', 'hobby-track.out.log'),
      error_file: path.join(__dirname, 'logs', 'hobby-track.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
