import { Fragment, useMemo, useState } from "react";
import { BookOpen, GitBranch, Info } from "lucide-react";
import {
  DEFAULT_EXTRA_RULES,
  DEFAULT_RULES,
  type CrossAnalysis,
  type OffspringCell,
  parseExtraRules,
  parseRules,
  runCrossAnalysis,
} from "./genetics";

const DEFAULT_PARENT_1 = "Aa Bb";
const DEFAULT_PARENT_2 = "Aa Bb";
const CLASSIC_PEA_9331_EXAMPLE = {
  parent1: "Aa Bb",
  parent2: "Aa Bb",
  rules: DEFAULT_RULES,
  extraRules: DEFAULT_EXTRA_RULES,
};
const SEX_LINKED_EXAMPLE = {
  parent1: "Aa ; X(c)X(c)",
  parent2: "aa ; X(C)Y",
  rules: `A_ 红花
aa 白花
C_ 抗病
cc 感病`,
  extraRules: DEFAULT_EXTRA_RULES,
};

function getDivisors(value: number) {
  const divisors: number[] = [];
  for (let candidate = 1; candidate <= Math.sqrt(value); candidate += 1) {
    if (value % candidate !== 0) {
      continue;
    }
    divisors.push(candidate);
    if (candidate !== value / candidate) {
      divisors.push(value / candidate);
    }
  }
  return divisors.sort((left, right) => right - left);
}

function combinations(values: number[], size: number): number[][] {
  if (size === 0) {
    return [[]];
  }
  if (values.length < size) {
    return [];
  }

  const result: number[][] = [];
  values.forEach((value, index) => {
    const tails = combinations(values.slice(index + 1), size - 1);
    tails.forEach((tail) => result.push([value, ...tail]));
  });
  return result;
}

function factorizeRatio(counts: number[]) {
  if (counts.length < 4) {
    return null;
  }

  const sortedCounts = [...counts].sort((left, right) => right - left);
  const total = sortedCounts.length;
  const max = sortedCounts[0];

  for (let leftSize = 2; leftSize < total; leftSize += 1) {
    if (total % leftSize !== 0) {
      continue;
    }

    const rightSize = total / leftSize;

    for (const leftMax of getDivisors(max)) {
      const rightMax = max / leftMax;
      const leftCandidates = [
        ...new Set(
          sortedCounts
            .filter((count) => count % rightMax === 0)
            .map((count) => count / rightMax),
        ),
      ].sort((a, b) => b - a);
      const rightCandidates = [
        ...new Set(
          sortedCounts
            .filter((count) => count % leftMax === 0)
            .map((count) => count / leftMax),
        ),
      ].sort((a, b) => b - a);

      const leftCombos = combinations(leftCandidates, leftSize).filter(
        (combo) => combo[0] === leftMax,
      );
      const rightCombos = combinations(rightCandidates, rightSize).filter(
        (combo) => combo[0] === rightMax,
      );

      for (const leftCombo of leftCombos) {
        for (const rightCombo of rightCombos) {
          const products = leftCombo.flatMap((leftValue) =>
            rightCombo.map((rightValue) => leftValue * rightValue),
          );
          const sortedProducts = products.sort((a, b) => b - a);
          if (
            sortedProducts.every(
              (value, index) => value === sortedCounts[index],
            )
          ) {
            return `${formatInlineRatio(leftCombo)}${formatInlineRatio(rightCombo)}`;
          }
        }
      }
    }
  }

  return null;
}

function formatInlineRatio(values: number[]) {
  return `(${values.join(":")})`;
}

function formatRatioWithFactors(
  entries: Array<{ label: string; count: number }>,
) {
  const counts = entries.map((entry) => entry.count);
  const base = counts.join(":");
  const factorized = factorizeRatio(counts);
  return factorized ? `${base} = ${factorized}` : base;
}

function formatRulePreview(rawRule: string) {
  return rawRule.trim() || "未定义规则";
}

function renderGenotypeText(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /([XYZW])\(([A-Za-z]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={`${match.index}-${match[0]}`}>
        <span>{match[1]}</span>
        <sup className="mr-px text-[0.62em] leading-none">{match[2]}</sup>
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function buildLifecycleStats(cells: OffspringCell[]) {
  const viability = new Map<string, number>();
  const sex = new Map<string, number>();

  for (const cell of cells) {
    const viabilityKey = cell.viability.isViable ? "存活" : "致死";
    viability.set(viabilityKey, (viability.get(viabilityKey) ?? 0) + 1);

    const sexKey = cell.sexContext.phenotypicSex ?? "未定性";
    sex.set(sexKey, (sex.get(sexKey) ?? 0) + 1);
  }

  return {
    viability: [...viability.entries()].map(([label, count]) => ({
      label,
      count,
    })),
    sex: [...sex.entries()].map(([label, count]) => ({ label, count })),
  };
}

function App() {
  const [parent1Input, setParent1Input] = useState(DEFAULT_PARENT_1);
  const [parent2Input, setParent2Input] = useState(DEFAULT_PARENT_2);
  const [rulesInput, setRulesInput] = useState(DEFAULT_RULES);
  const [extraRulesInput, setExtraRulesInput] = useState(DEFAULT_EXTRA_RULES);
  const [highlightToken, setHighlightToken] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);

  const ruleSet = useMemo(() => parseRules(rulesInput), [rulesInput]);
  const extraRuleSet = useMemo(
    () => parseExtraRules(extraRulesInput),
    [extraRulesInput],
  );
  const analysisState = useMemo<{
    analysis: CrossAnalysis | null;
    runtimeError: string | null;
  }>(() => {
    try {
      return {
        analysis: runCrossAnalysis(
          parent1Input,
          parent2Input,
          ruleSet.rules,
          extraRuleSet.rules,
        ),
        runtimeError: null,
      };
    } catch (error) {
      return {
        analysis: null,
        runtimeError: error instanceof Error ? error.message : "输入无效。",
      };
    }
  }, [extraRuleSet.rules, parent1Input, parent2Input, ruleSet.rules]);
  const analysis = analysisState.analysis;

  const activeError =
    analysisState.runtimeError ??
    analysis?.errors[0] ??
    ruleSet.errors[0] ??
    extraRuleSet.errors[0] ??
    null;

  const normalizedParents = analysis
    ? [
        analysis.parents.parent1.genotype.normalized,
        analysis.parents.parent2.genotype.normalized,
      ]
    : [null, null];
  const lifecycleStats = analysis
    ? buildLifecycleStats(analysis.grid.flatMap((row) => row.cells))
    : null;

  function applyExample(index: number) {
    const examples = [CLASSIC_PEA_9331_EXAMPLE, SEX_LINKED_EXAMPLE];
    const example = examples[index % examples.length];
    setParent1Input(example.parent1);
    setParent2Input(example.parent2);
    setRulesInput(example.rules);
    setExtraRulesInput(example.extraRules);
    setHighlightToken(null);
  }

  function cycleExample() {
    const nextIndex = (exampleIndex + 1) % 2;
    setExampleIndex(nextIndex);
    applyExample(nextIndex);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 p-4 md:p-6">
      <header className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#101010] px-4 py-3">
        <div
          className="text-3xl leading-none md:text-4xl"
          style={{ fontFamily: '"Limelight", serif' }}
        >
          <span className="text-teal-400">Gene</span>
          <span className="text-white">Graph</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleExample}
            className="rounded-xl border border-zinc-800 bg-black p-2.5 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            aria-label="切换示例"
            title={
              exampleIndex === 0
                ? "当前下一个：伴性遗传"
                : "当前下一个：经典豌豆9331"
            }
          >
            <BookOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="rounded-xl border border-zinc-800 bg-black p-2.5 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            aria-label="About"
            title="About"
          >
            <Info className="h-4 w-4" />
          </button>
          <a
            href="https://github.com/Minsecrus/GeneGraph"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-zinc-800 bg-black p-2.5 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            aria-label="GitHub"
            title="GitHub"
          >
            <GitBranch className="h-4 w-4" />
          </a>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <div className="grid gap-3">
              <InputField
                label="P1"
                value={parent1Input}
                placeholder="Aa BBb ; X(C)X(c)"
                hint={normalizedParents[0] ?? ""}
                onChange={setParent1Input}
              />
              <InputField
                label="P2"
                value={parent2Input}
                placeholder="Aa Bb ; X(C)Y"
                hint={normalizedParents[1] ?? ""}
                onChange={setParent2Input}
              />
            </div>
          </Panel>

          <Panel>
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Rules</span>
              <span>{ruleSet.rules.length}</span>
            </div>
            <textarea
              value={rulesInput}
              onChange={(event) => setRulesInput(event.target.value)}
              rows={9}
              spellCheck={false}
              className="min-h-56 w-full resize-y rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-teal-400"
            />
          </Panel>

          <Panel>
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Extra Rules</span>
              <span>{extraRuleSet.rules.length}</span>
            </div>
            <textarea
              value={extraRulesInput}
              onChange={(event) => setExtraRulesInput(event.target.value)}
              rows={7}
              spellCheck={false}
              className="min-h-44 w-full resize-y rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-teal-400"
              placeholder={
                "配子致死 P1 aB\n配子致死 雄 X\n合子致死 Aabb\n基因定性 A_ 雌\n性反转 bb 雄"
              }
            />
          </Panel>

          {activeError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {activeError}
            </div>
          ) : null}
        </div>

        <Panel>
          {analysis ? (
            <div className="overflow-auto rounded-xl bg-black p-2">
              <div
                className="grid min-w-full gap-2"
                style={{
                  gridTemplateColumns: `9rem repeat(${analysis.gametePools.parent2.length}, minmax(6rem, 1fr))`,
                }}
              >
                <div className={axisClassName}>P1/P2</div>
                {analysis.gametePools.parent2.map((gamete) => (
                  <div key={`col-${gamete.id}`} className={axisClassName}>
                    <span>{renderGenotypeText(gamete.label)}</span>
                    <span className="text-[11px] text-zinc-500">
                      {gamete.probabilityText}
                    </span>
                  </div>
                ))}

                {analysis.grid.map((row) => (
                  <Fragment key={row.gamete.id}>
                    <div className={axisClassName}>
                      <span>{renderGenotypeText(row.gamete.label)}</span>
                      <span className="text-[11px] text-zinc-500">
                        {row.gamete.probabilityText}
                      </span>
                    </div>
                    {row.cells.map((cell) => (
                      <CellCard
                        key={cell.id}
                        cell={cell}
                        highlightToken={highlightToken}
                        onHover={setHighlightToken}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center text-sm text-zinc-600">
              no grid
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          {analysis ? (
            <div className="grid gap-4 md:grid-cols-2">
              <StatsBlock
                title="Genotype"
                items={analysis.genotypeStats}
                ratio={formatRatioWithFactors(analysis.genotypeStats)}
                onHover={setHighlightToken}
                tokenPrefix="genotype"
                highlightToken={highlightToken}
              />
              <StatsBlock
                title="Phenotype"
                items={analysis.phenotypeStats}
                ratio={
                  analysis.phenotypeFactorization.grouped
                    ? `${analysis.phenotypeFactorization.raw} = ${analysis.phenotypeFactorization.grouped}`
                    : formatRatioWithFactors(analysis.phenotypeStats)
                }
                onHover={setHighlightToken}
                tokenPrefix="phenotype"
                highlightToken={highlightToken}
              />
            </div>
          ) : (
            <div className="text-sm text-zinc-600">no data</div>
          )}
        </Panel>

        <Panel>
          <div className="space-y-2">
            {lifecycleStats ? (
              <div className="mb-3 grid gap-2 rounded-xl border border-zinc-800 bg-black p-3 text-xs text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>存活统计</span>
                  <span className="font-mono">
                    {lifecycleStats.viability
                      .map((item) => `${item.label}:${item.count}`)
                      .join("  ")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>性别统计</span>
                  <span className="font-mono">
                    {lifecycleStats.sex
                      .map((item) => `${item.label}:${item.count}`)
                      .join("  ")}
                  </span>
                </div>
              </div>
            ) : null}
            {ruleSet.rules.map((rule, index) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <div className="w-5 text-xs text-zinc-500">{index + 1}</div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="truncate font-mono text-xs text-zinc-300">
                    {formatRulePreview(rule.source)}
                  </div>
                </div>
                <span
                  className="h-3 w-3 rounded-full border border-white/10"
                  style={{ backgroundColor: rule.color }}
                  aria-hidden="true"
                />
              </div>
            ))}
            {extraRuleSet.rules.map((rule, index) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <div className="w-5 text-xs text-zinc-500">E{index + 1}</div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="truncate font-mono text-xs text-zinc-300">
                    {formatRulePreview(rule.source)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {infoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#101010] p-6 md:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div
                className="text-3xl leading-none text-white"
                style={{ fontFamily: '"Limelight", serif' }}
              >
                About
              </div>
            </div>
            <div className="space-y-3 text-sm text-zinc-300">
              <p>高中遗传学杂交模拟工具。</p>
              <p>支持多位点基因型解析、规则匹配、棋盘格和比例分析。</p>
              <p>QQ 群：885719573</p>
              <p>
                By{" "}
                <a
                  href="https://github.com/Minsecrus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline"
                >
                  Minsecrus
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatsBlock({
  title,
  items,
  ratio,
  onHover,
  tokenPrefix,
  highlightToken,
}: {
  title: string;
  items: Array<{
    label: string;
    count: number;
    probabilityText: string;
    token: string;
  }>;
  ratio: string;
  onHover: (token: string | null) => void;
  tokenPrefix: string;
  highlightToken: string | null;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <h2 className="font-medium text-zinc-200">{title}</h2>
        <span className="font-mono text-zinc-500">{ratio}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const token = `${tokenPrefix}:${item.token}`;
          const isActive = highlightToken === token;
          return (
            <button
              key={token}
              type="button"
              className={[
                "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                isActive
                  ? "border-teal-400/60 bg-teal-400/10"
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-700",
              ].join(" ")}
              onMouseEnter={() => onHover(token)}
              onMouseLeave={() => onHover(null)}
            >
              <strong className="truncate font-mono leading-relaxed text-zinc-100">
                {title === "Genotype"
                  ? renderGenotypeText(item.label)
                  : item.label}
              </strong>
              <span className="text-zinc-400">{item.count}</span>
              <small className="font-mono text-zinc-500">
                {item.probabilityText}
              </small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CellCard({
  cell,
  highlightToken,
  onHover,
}: {
  cell: OffspringCell;
  highlightToken: string | null;
  onHover: (token: string | null) => void;
}) {
  const isActive =
    highlightToken === `genotype:${cell.genotype}` ||
    highlightToken === `phenotype:${cell.phenotype.label}`;

  return (
    <article
      className={[
        "relative flex min-h-28 flex-col justify-between border border-zinc-900 px-3 py-2 text-left transition",
        !cell.viability.isViable
          ? "bg-rose-950/20"
          : cell.sexContext.phenotypicSex === "雌"
            ? "bg-pink-400/8"
            : cell.sexContext.phenotypicSex === "雄"
              ? "bg-sky-400/8"
              : "",
        isActive ? "z-10 ring-1 ring-teal-400/80" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="w-fit cursor-pointer bg-transparent p-0 font-mono text-left text-sm text-zinc-100"
          onMouseEnter={() => onHover(`genotype:${cell.genotype}`)}
          onMouseLeave={() => onHover(null)}
        >
          {renderGenotypeText(cell.genotype)}
        </button>
        <small className="font-mono text-[11px] text-zinc-500">
          {cell.probabilityText}
        </small>
      </div>
      <button
        type="button"
        className="w-fit cursor-pointer bg-transparent p-0 text-left text-sm"
        onMouseEnter={() => onHover(`phenotype:${cell.phenotype.label}`)}
        onMouseLeave={() => onHover(null)}
      >
        <span className="flex flex-wrap gap-x-1 gap-y-0.5">
          {cell.phenotype.parts.map((part) => (
            <span
              key={`${cell.id}-${part.label}`}
              style={{ color: part.color }}
            >
              {part.label}
            </span>
          ))}
        </span>
      </button>
      <div className="flex flex-wrap gap-1">
        {cell.sexContext.reversalApplied ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
            性反转
          </span>
        ) : null}
        {!cell.viability.isViable ? (
          <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-200">
            {cell.viability.reason ?? "致死"}
          </span>
        ) : null}
      </div>
      <small className="font-mono text-[11px] text-zinc-600">
        {cell.match.map((item) => item.pattern).join(" + ")}
      </small>
    </article>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#101010] p-3 md:p-4">
      {children}
    </section>
  );
}

function InputField({
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  hint: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="font-mono">{hint}</span>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-teal-400"
      />
    </label>
  );
}

const axisClassName =
  "flex min-h-20 flex-col items-center justify-center gap-1 border border-zinc-900 bg-zinc-950 px-2 py-3 text-center text-sm font-mono text-zinc-200";

export default App;
