#!/usr/bin/env bash
# .agents/tools/remove-ticket-refs.sh
# Removes ticket ID references from comments while preserving descriptive content.
# 
# Context:
#   address eslint rules 'no-ticket-refs-in-comments', 'todo-ticket-refs-in-comments'
#   
# Usage:
#   remove-ticket-refs.sh packages/srs-engine
#   remove-ticket-refs.sh apps/srs-demo   (walks .vue files too)
#   remove-ticket-refs.sh <file...>   (lint-staged passes staged files this way)
#
# Patterns handled:
#   /** TicketID: text */ → /** text */
#   // TicketID: text → // text
#   (TicketID §n) → removed
#   (unchanged from TicketID) → removed

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# --import tsx/esm lets the script import eslint-rules/ticket-ref-pattern.ts directly,
# so the abbreviation list can't drift from the one the eslint rule matches against.
exec node --import tsx/esm "$DIR/lib/remove-ticket-refs.mjs" "$@"
