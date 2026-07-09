import { defineBackground } from "#imports"

import { bootBackground } from "../background"

// Thin adapter: all logic lives in src/background (the "brain").
export default defineBackground(() => {
  bootBackground()
})
