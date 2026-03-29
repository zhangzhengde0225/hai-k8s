#!/bin/bash
cd "$(dirname "$0")/haik8s/frontend"
exec npm run dev -- --host 0.0.0.0 --port 42901
