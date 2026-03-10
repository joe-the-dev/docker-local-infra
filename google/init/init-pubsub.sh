#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PUBSUB_PROJECT_ID:-hx-external-staging}"
EMULATOR_HOST="${PUBSUB_EMULATOR_HOST:-pubsub-emulator:8085}"
TOPIC="${PUBSUB_TOPIC:-external~~integration-gateway_incoming}"
SUBSCRIPTION="${PUBSUB_SUBSCRIPTION:-name}"

BASE_URL="http://${EMULATOR_HOST}/v1"

echo "──────────────────────────────────────────"
echo " Pub/Sub Emulator Init"
echo " Project  : ${PROJECT_ID}"
echo " Host     : ${EMULATOR_HOST}"
echo " Topic    : ${TOPIC}"
echo " Sub      : ${SUBSCRIPTION}"
echo "──────────────────────────────────────────"

# ── wait until emulator is ready ──────────────────────────────────────────────
echo "Waiting for Pub/Sub emulator to be ready..."
until curl -sf "${BASE_URL}/projects/${PROJECT_ID}/topics" > /dev/null 2>&1; do
  echo "  not ready yet, retrying in 2s…"
  sleep 2
done
echo "Emulator is ready ✔"

# ── create topic ───────────────────────────────────────────────────────────────
TOPIC_URL="${BASE_URL}/projects/${PROJECT_ID}/topics/${TOPIC}"
echo "Creating topic: projects/${PROJECT_ID}/topics/${TOPIC}"
RESPONSE=$(curl -sf -X PUT "${TOPIC_URL}" \
  -H "Content-Type: application/json" \
  -d '{}' 2>&1) && echo "  Topic created ✔" || echo "  Topic may already exist (${RESPONSE})"

# ── create subscription ────────────────────────────────────────────────────────
SUB_URL="${BASE_URL}/projects/${PROJECT_ID}/subscriptions/${SUBSCRIPTION}"
echo "Creating subscription: projects/${PROJECT_ID}/subscriptions/${SUBSCRIPTION}"
RESPONSE=$(curl -sf -X PUT "${SUB_URL}" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"projects/${PROJECT_ID}/topics/${TOPIC}\"}" 2>&1) \
  && echo "  Subscription created ✔" || echo "  Subscription may already exist (${RESPONSE})"

echo ""
echo "Done! Resources provisioned in project '${PROJECT_ID}' ✔"

