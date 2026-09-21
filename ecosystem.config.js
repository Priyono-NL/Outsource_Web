module.exports = {
  apps: [
    {
      name: 'webos-backend',
      cwd: '/home/andreas/Projects/WebOS/backend',
      script: './.venv/bin/gunicorn',
      args: '-w 4 -b 0.0.0.0:5301 app:app',
      interpreter: 'none'
    },
    {
      name: 'webos-frontend',
      script: 'npx',
      args: 'serve -s dist -l 3000',
      cwd: '/home/andreas/Projects/WebOS',
      interpreter: 'none'
    }
  ]
};