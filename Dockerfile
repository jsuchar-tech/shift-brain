# Start with a Node.js base
FROM node:22-slim

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy and install Node dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set your start command (change index.js to your actual entry point)
CMD ["node", "api/server.js"]
