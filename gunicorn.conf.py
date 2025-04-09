# Gunicorn configuration file for Render deployment

# Worker processes
workers = 4
worker_class = 'sync'
worker_connections = 1000
timeout = 60
keepalive = 2

# Server socket
bind = "0.0.0.0:$PORT"  # Using environment variable PORT provided by Render

# Server mechanics
preload_app = True

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info' 