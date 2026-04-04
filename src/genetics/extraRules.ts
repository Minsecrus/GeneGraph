import type {
  ExtraRule,
  ExtraRuleParseResult,
} from './types'

function parseGameteDeathRule(index: number, line: string): ExtraRule | string {
  const match = line.match(/^配子致死\s+(P1|P2|雄|雌|全部)\s+(\S+)$/)
  if (!match) {
    return `额外规则第 ${index + 1} 行格式无效，应为：配子致死 <P1|P2|雄|雌|全部> <单倍体模式>。`
  }

  const [, sex, pattern] = match
  return {
    id: `extra-rule-${index}`,
    stage: 'gamete',
    label: line,
    source: line,
    when: `${sex} ${pattern}`,
    effect: { type: 'block-gamete', reason: line },
  }
}

function parseZygoteDeathRule(index: number, line: string): ExtraRule | string {
  const match = line.match(/^合子致死\s+(\S+)$/)
  if (!match) {
    return `额外规则第 ${index + 1} 行格式无效，应为：合子致死 <模式>。`
  }

  const [, pattern] = match
  return {
    id: `extra-rule-${index}`,
    stage: 'viability',
    label: line,
    source: line,
    when: pattern,
    effect: { type: 'kill-zygote', reason: line },
  }
}

function parseGeneSexRule(index: number, line: string): ExtraRule | string {
  const match = line.match(/^基因定性\s+(\S+)\s+(雄|雌)$/)
  if (!match) {
    return `额外规则第 ${index + 1} 行格式无效，应为：基因定性 <模式> <雄|雌>。`
  }

  const [, pattern, sex] = match
  return {
    id: `extra-rule-${index}`,
    stage: 'sex',
    label: line,
    source: line,
    when: pattern,
    effect: { type: 'set-phenotypic-sex', value: sex },
  }
}

function parseSexReversalRule(index: number, line: string): ExtraRule | string {
  const match = line.match(/^性反转\s+(\S+)\s+(雄|雌)$/)
  if (!match) {
    return `额外规则第 ${index + 1} 行格式无效，应为：性反转 <模式> <雄|雌>。`
  }

  const [, pattern] = match
  return {
    id: `extra-rule-${index}`,
    stage: 'sex',
    label: line,
    source: line,
    when: pattern,
    effect: { type: 'mark-reversal' },
  }
}

function parseSexReversalTargetRule(index: number, line: string): ExtraRule | null {
  const match = line.match(/^性反转\s+(\S+)\s+(雄|雌)$/)
  if (!match) {
    return null
  }

  const [, pattern, sex] = match
  return {
    id: `extra-rule-${index}-target`,
    stage: 'sex',
    label: line,
    source: line,
    when: pattern,
    effect: { type: 'set-phenotypic-sex', value: sex },
  }
}

export function parseExtraRules(input: string): ExtraRuleParseResult {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  const rules: ExtraRule[] = []
  const errors: string[] = []

  for (const [index, line] of lines.entries()) {
    let parsed: ExtraRule | string

    if (line.startsWith('配子致死')) {
      parsed = parseGameteDeathRule(index, line)
    } else if (line.startsWith('合子致死')) {
      parsed = parseZygoteDeathRule(index, line)
    } else if (line.startsWith('基因定性')) {
      parsed = parseGeneSexRule(index, line)
    } else if (line.startsWith('性反转')) {
      parsed = parseSexReversalRule(index, line)
    } else {
      errors.push(
        `额外规则第 ${index + 1} 行前缀无效，应以“配子致死 / 合子致死 / 基因定性 / 性反转”开头。`,
      )
      continue
    }

    if (typeof parsed === 'string') {
      errors.push(parsed)
      continue
    }

    rules.push(parsed)

    const reversalTarget = line.startsWith('性反转')
      ? parseSexReversalTargetRule(index, line)
      : null
    if (reversalTarget) {
      rules.push(reversalTarget)
    }
  }

  return { rules, errors }
}
