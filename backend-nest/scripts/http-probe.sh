#!/bin/bash
# HTTP Probe Helper (Bash)
# Probes URLs with GET/HEAD and returns first 200 or summary
# Usage: ./http-probe.sh -u "http://127.0.0.1:5002/health" -m GET -t 1500

METHOD="GET"
TIMEOUT_MS=1500
URLS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--urls)
            shift
            while [[ $# -gt 0 ]] && [[ ! $1 =~ ^- ]]; do
                URLS+=("$1")
                shift
            done
            ;;
        -m|--method)
            METHOD="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT_MS="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

TIMEOUT_SEC=$(echo "scale=2; $TIMEOUT_MS / 1000" | bc)
if [ -z "$TIMEOUT_SEC" ]; then
    TIMEOUT_SEC=1.5
fi

for url in "${URLS[@]}"; do
    if [ "$METHOD" = "HEAD" ]; then
        HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT_SEC" -I "$url" 2>/dev/null || echo "000")
    else
        HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT_SEC" "$url" 2>/dev/null || echo "000")
    fi
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "{\"url\":\"$url\",\"statusCode\":200,\"ok\":true}"
        exit 0
    fi
done

# No 200 found
echo "{\"ok\":false}"
exit 1

