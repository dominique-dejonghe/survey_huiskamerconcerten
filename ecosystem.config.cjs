module.exports = {
  apps: [
    {
      name: 'survey',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        ADMIN_EMAIL: 'dominique@pensato.org',
        ADMIN_PASSWORD: 'P@n@sonic1',
        SESSION_SECRET: 'dev-session-secret-change-me-in-production-min-32-chars-9f8a3c2b',
        IP_HASH_SALT: 'dev-ip-hash-salt-change-me-in-production-min-32-chars-1d4e6b7c',
        EMAIL_ENABLED: 'false',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
}
