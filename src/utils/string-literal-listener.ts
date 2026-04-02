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

export function extractContentAndWrapper(
  text: string,
  node: Literal | TemplateLiteral,
): { content: string | null; wrapper: string } {
  if (node.type === 'Literal' && typeof node.value === 'string' && typeof node.raw === 'string') {
    const quote = node.raw[0]
    if (quote === '"' || quote === "'") {
      return { content: node.raw.slice(1, -1), wrapper: quote }
    }
    return { content: null, wrapper: '' }
  }

  if (node.type === 'TemplateLiteral') {
    return { content: text, wrapper: '`' }
  }

  return { content: null, wrapper: '' }
}

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
