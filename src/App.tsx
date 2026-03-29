import { Fragment, useMemo, useState } from "react";
import { GitBranch, Info } from "lucide-react";
import {
  DEFAULT_RULES,
  type CrossAnalysis,
  type OffspringCell,
  parseRules,
  runCrossAnalysis,
} from "./genetics";

const DEFAULT_PARENT_1 = "AaBb";
const DEFAULT_PARENT_2 = "AaBb";

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

function App() {
  const [parent1Input, setParent1Input] = useState(DEFAULT_PARENT_1);
  const [parent2Input, setParent2Input] = useState(DEFAULT_PARENT_2);
  const [rulesInput, setRulesInput] = useState(DEFAULT_RULES);
  const [highlightToken, setHighlightToken] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const ruleSet = useMemo(() => parseRules(rulesInput), [rulesInput]);
  const analysisState = useMemo<{
    analysis: CrossAnalysis | null;
    runtimeError: string | null;
  }>(() => {
    try {
      return {
        analysis: runCrossAnalysis(parent1Input, parent2Input, ruleSet.rules),
        runtimeError: null,
      };
    } catch (error) {
      return {
        analysis: null,
        runtimeError: error instanceof Error ? error.message : "输入无效。",
      };
    }
  }, [parent1Input, parent2Input, ruleSet.rules]);
  const analysis = analysisState.analysis;

  const activeError =
    analysisState.runtimeError ??
    analysis?.errors[0] ??
    ruleSet.errors[0] ??
    null;

  const normalizedParents = analysis
    ? [analysis.parents.parent1.normalized, analysis.parents.parent2.normalized]
    : [null, null];

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
            onClick={() => setInfoOpen(true)}
            className="rounded-xl border border-zinc-800 bg-black p-2.5 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            aria-label="About"
          >
            <Info className="h-4 w-4" />
          </button>
          <a
            href="https://github.com/Minsecrus/GeneGraph"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-zinc-800 bg-black p-2.5 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
            aria-label="GitHub"
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
                placeholder="AaBb"
                hint={normalizedParents[0] ?? ""}
                onChange={setParent1Input}
              />
              <InputField
                label="P2"
                value={parent2Input}
                placeholder="AaBb"
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
            <div className="mt-2 text-[11px] text-zinc-600">pattern label</div>
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
                  gridTemplateColumns: `9rem repeat(${analysis.parents.parent2.gametes.length}, minmax(6rem, 1fr))`,
                }}
              >
                <div className={axisClassName}>P1/P2</div>
                {analysis.parents.parent2.gametes.map((gamete) => (
                  <div key={`col-${gamete.id}`} className={axisClassName}>
                    <span>{gamete.label}</span>
                    <span className="text-[11px] text-zinc-500">
                      {gamete.probabilityText}
                    </span>
                  </div>
                ))}

                {analysis.grid.map((row) => (
                  <Fragment key={row.gamete.id}>
                    <div className={axisClassName}>
                      <span>{row.gamete.label}</span>
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
              <strong className="truncate font-mono text-zinc-100">
                {item.label}
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
        "relative flex min-h-24 flex-col justify-between border border-zinc-900 px-3 py-2 text-left transition",
        isActive ? "z-10 ring-1 ring-teal-400/80" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="w-fit cursor-pointer bg-transparent p-0 font-mono text-left text-sm text-zinc-100"
        onMouseEnter={() => onHover(`genotype:${cell.genotype}`)}
        onMouseLeave={() => onHover(null)}
      >
        {cell.genotype}
      </button>
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
