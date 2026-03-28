# Benchmarks

This directory contains measurement and testing scripts for the paper experiments.

## Scripts

| Script | Purpose | Experiment |
|--------|---------|-----------|
| `measure_cold_start.py` | Measure OpenClaw initialization time breakdown | Exp 1: Cold-Start |
| `test_isolation.py` | Simulate malicious Skill attack inside container | Exp 4: Security |

## Usage

### Cold-Start Measurement

Requires hai-k8s backend running and K8s access.

```bash
python3 measure_cold_start.py <container_id> <hepai_api_key> \
    --admin-api-key <KEY> \
    --user-jwt <TOKEN> \
    --gateway-password <PWD>
```

### Isolation Security Test

⚠️ **Only run in controlled test environment.**

```bash
python3 test_isolation.py <container_id> \
    --admin-api-key <KEY> \
    --user-jwt <TOKEN>
```

## Pre-Measurement Results

Measured on 2026-03-28:

| Component | Time |
|-----------|------|
| `openclaw onboard` (pre-configured env, repeated) | 1.344s |
| `openclaw onboard` (fresh container, estimated) | 3-8s |
| Python JSON config modification | ~14ms |

Full breakdown available in `../discussion/08_measurement_results.md`.
