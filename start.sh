#!/bin/bash
# Start the Astro workspace file server
# Usage: ./start.sh [port]
# Default port: 6789

PORT=${1:-6789} npm run dev -- --port $PORT
