import type { Rule } from 'eslint'
import type { Literal, TemplateLiteral } from 'estree'

export function createStringLiteralListener(
  includeEscapedUnicode: boolean,
  visitLiteral: StringLiteralVisitor,
): Rule.RuleListener {
  function inspect(node: Literal | TemplateLiteral): void {
    const text = getStringValue(node, includeEscapedUnicode)
    if (text == undefined) {
      return
    }

    visitLiteral(node, text)
  }

  return {
    Literal: inspect,
    TemplateLiteral: inspect,
  }
}

type StringLiteralVisitor = (node: Literal | TemplateLiteral, text: string) => void

function getStringValue(
  node: Literal | TemplateLiteral,
  includeEscapedUnicode: boolean,
): string | undefined {
  if (node.type === 'TemplateLiteral') {
    return node.quasis
      .map((q) =>
        includeEscapedUnicode ? (q.value.raw ?? q.value.cooked ?? '') : (q.value.cooked ?? ''),
      )
      .join('')
  }

  if (typeof node.value !== 'string') {
    return undefined
  }

  return includeEscapedUnicode ? (node.raw ?? node.value) : node.value
}
