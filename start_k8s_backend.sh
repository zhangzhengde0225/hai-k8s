#!/bin/bash
cd "$(dirname "$0")/haik8s/backend"
exec uvicorn main:app --host 0.0.0.0 --port 42900 --reload
