module.exports = {
  apps: [
    {
      name: 'online-menu',
      script: 'node_modules/.bin/next',
      args: 'start -p 3017',
      cwd: '/www/wwwroot/online-menu',
      env: {
        NODE_ENV: 'production',
        PORT: '3017',
      },
      max_memory_restart: '512M',
      autorestart: true,
    },
  ],
}
