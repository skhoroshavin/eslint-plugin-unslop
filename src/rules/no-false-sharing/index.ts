import type { Rule } from 'eslint'
import type ts from 'typescript'
import { resolveSourceContext } from '../../utils/source-root.js'
import { isRecord, readDirsOption, readSourceRootOption } from '../../utils/rule-options.js'
import { runConsumerCheck } from './analysis.js'

const SCHEMA = [
  {
    type: 'object',
    properties: {
      dirs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            mode: { type: 'string', enum: ['file', 'dir'] },
          },
          required: ['path'],
          additionalProperties: false,
        },
      },
      mode: { type: 'string', enum: ['file', 'dir'] },
      sourceRoot: { type: 'string' },
    },
    required: ['dirs'],
    additionalProperties: false,
  },
]

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require selected modules to be shared across at least two consumer entities',
      recommended: false,
    },
    schema: SCHEMA,
  },
  create(context: Rule.RuleContext) {
    const dirs = readDirsOption(context.options)
    if (dirs.length === 0) {
      return {}
    }

    const filename = context.filename
    const sourceRootOption = readSourceRootOption(context.options)
    const sourceContext = resolveSourceContext(filename, sourceRootOption)
    if (!sourceContext) {
      return {}
    }

    const { sourceRelativePath, sourceRoot, projectRoot } = sourceContext

    return {
      Program(node) {
        const program = extractTsProgram(context)
        if (!program) {
          return
        }

        const errors = runConsumerCheck(program, projectRoot, sourceRoot, dirs)
        const fileErrors = errors.get(sourceRelativePath)
        if (!fileErrors) {
          return
        }

        for (const message of fileErrors) {
          context.report({ node, message })
        }
      },
    }
  },
} satisfies Rule.RuleModule

function extractTsProgram(context: Rule.RuleContext): ts.Program | undefined {
  const services = context.sourceCode.parserServices
  if (!isRecord(services) || !('program' in services)) {
    return undefined
  }
  const program = services.program
  if (!isTsProgram(program)) {
    return undefined
  }
  return program
}

function isTsProgram(value: unknown): value is ts.Program {
  return isRecord(value) && 'getTypeChecker' in value
}
