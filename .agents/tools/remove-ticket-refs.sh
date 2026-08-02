#!/usr/bin/env bash
# .agents/tools/remove-ticket-refs.sh
# Removes ticket ID references from comments while preserving descriptive content.
# 
# Context:
#   address eslint rules 'no-ticket-refs-in-comments', 'todo-ticket-refs-in-comments'
#   
# Usage:
#   remove-ticket-refs.sh packages/srs-engine
#   remove-ticket-refs.sh apps/server
#
# Patterns handled:
#   /** TicketID: text */ → /** text */
#   // TicketID: text → // text
#   (TicketID §n) → removed
#   (unchanged from TicketID) → removed

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/remove-ticket-refs.mjs" "$@"
