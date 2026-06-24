# Hostinger VPS Deployment Guide for VTL Chat

This guide outlines the step-by-step instructions to deploy the VTL Chat application onto a Hostinger VPS running Ubuntu (22.04 LTS recommended). The platform uses Docker Compose to run a Django-Daphne backend, a PostgreSQL database, a Redis queue, and a React frontend.

---

## Prerequisites

Before starting, ensure you have:
1. A **Hostinger VPS** running Ubuntu 22.04 LTS.
2. An active **Domain Name** (e.g., `chat.yourdomain.com`) pointed to your VPS IP address via DNS A-Records.
3. Standard SSH access to the server with `root` or `sudo` privileges.

---

## Step 1: System Package Update and Docker Installation

Connect to your VPS via SSH and install Docker and Docker Compose.

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y curl git apt-transport-https ca-certificates gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the stable repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installations
docker --version
docker compose version
```

---

## Step 2: Clone the Project Repository

Clone your repository into the `/var/www` directory or another preferred location.

```bash
# Navigate to the target directory
cd /var/www

# Clone the repository
git clone <YOUR_GIT_REPOSITORY_URL> vtl-chat
cd vtl-chat
```

---

## Step 3: Configure Environment Variables

Create the required environment files for both production environments.

### 1. Backend Environment Configurations
Create a `backend/.env` file:
```bash
nano backend/.env
```
Populate it with the following configuration (replace placeholders with actual values):
```env
DEBUG=False
SECRET_KEY=generate-a-strong-random-django-secret-key-here
ALLOWED_HOSTS=chat.yourdomain.com,backend,127.0.0.1
CORS_ALLOWED_ORIGINS=https://chat.yourdomain.com

# PostgreSQL Credentials
DB_NAME=teams_platform_db
DB_USER=teams_user
DB_PASSWORD=select-a-strong-secure-password
DB_HOST=db
DB_PORT=5432

# Redis configuration
REDIS_URL=redis://redis:6379/0
```

### 2. Match Postgres credentials in `docker-compose.yml`
Ensure that the credentials in `docker-compose.yml` under the `db` environment match your backend's configuration:
```yaml
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: teams_platform_db
      POSTGRES_USER: teams_user
      POSTGRES_PASSWORD: select-a-strong-secure-password
```

---

## Step 4: Build & Run with Docker Compose

Build the docker images and run them in detached (background) mode.

```bash
# Build the Docker containers
docker compose build

# Start services in the background
docker compose up -d

# Verify container statuses and health
docker compose ps
```

Check the backend container logs to ensure database migrations ran successfully:
```bash
docker compose logs -f backend
```

---

## Step 5: Nginx Reverse Proxy & Let's Encrypt SSL Setup

To handle HTTPS and proxy incoming traffic to the React frontend (running in container on port `5173`) and Django/Daphne backend (running on port `8000`), we will install and configure Nginx on the host VPS.

### 1. Install Nginx and Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configure Nginx Server Block
Create a configuration file:
```bash
sudo nano /etc/nginx/sites-available/chat.yourdomain.com
```

Insert the following server block configuration:
```nginx
server {
    listen 80;
    server_name chat.yourdomain.com;

    # Static frontend reverse proxy
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API routing
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django channels / ASGI WebSockets
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Enable Configuration and Test Nginx
```bash
# Link configuration to sites-enabled
sudo ln -s /etc/nginx/sites-available/chat.yourdomain.com /etc/nginx/sites-enabled/

# Remove default configuration if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration for syntax errors
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 4. Install SSL Certificates
Obtain and apply SSL certificates automatically using Certbot:
```bash
sudo certbot --nginx -d chat.yourdomain.com
```
Follow the interactive prompts. Certbot will handle verification, download the SSL certificates from Let's Encrypt, and automatically configure Nginx to redirect HTTP traffic to HTTPS.

---

## Step 6: Troubleshooting & Logs

To check container statuses, resource usage, or logs, use the following commands inside `/var/www/vtl-chat`:

* **Check container health & uptime:**
  ```bash
  docker compose ps
  ```
* **View all container logs:**
  ```bash
  docker compose logs -f
  ```
* **Restart the application:**
  ```bash
  docker compose restart
  ```
* **Apply database migrations manually (if needed):**
  ```bash
  docker compose exec backend python manage.py migrate
  ```
* **Create a Django superuser on production:**
  ```bash
  docker compose exec backend python manage.py createsuperuser
  ```
