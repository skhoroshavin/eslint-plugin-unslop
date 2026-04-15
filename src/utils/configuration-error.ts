import type { Rule } from 'eslint'

import type { Program } from 'estree'

export function createConfigurationErrorListeners(
  context: Rule.RuleContext,
  details: string,
): Rule.RuleListener {
  return {
    Program(node: Program) {
      context.report({
        node,
        messageId: 'configurationError',
        data: { details },
      })
    },
  }
}
