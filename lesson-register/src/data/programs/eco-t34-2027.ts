// HSC Economics Topics 3 & 4 — 2027 parallel program, converted from
// "HSC Economics Topics 3 & 4 — 2027 Prospective Program (parallel model)".
// Wording is taken from the program; activities are the program's own steps.
// Outcome tags are suggestions to check.

import type { Activity, Item, Program, Resource, Unit } from '../../lib/types';

const R = {
  booklet: { id: 'r.booklet', title: 'Student booklet 2026–27' },
  site: { id: 'r.site', title: 'Google Site: Topic 3 and Topic 4 pages' },
  scorecard: { id: 'r.scorecard', title: 'Economic scorecard' },
  news: { id: 'r.news', title: 'Weekly news summary' },
  criteria: { id: 'r.criteria', title: 'AT3/AT4 criteria, automatic caps and feedback sheets' },
  erb: { id: 'r.erb', title: 'Extended Response Builder' },
  qf: { id: 'r.qf', title: 'Question Finder' },
  ef: { id: 'r.ef', title: 'Evidence Finder' },
  calc: { id: 'r.calc', title: 'Calculation Trainer' },
  mdl: { id: 'r.mdl', title: 'Macro Diagram Lab' },
  chain: { id: 'r.chain', title: 'Chain Builder' },
  sim: { id: 'r.sim', title: 'Policy Simulator' },
  mcd: { id: 'r.mcd', title: 'Multiple Choice Drill' },
  gloss: { id: 'r.gloss', title: 'Glossary' },
  skills: { id: 'r.skills', title: 'Diagram and calculation skills resource' },
  q27: { id: 'r.q27', title: 'Q27 inflation essay deconstruction lesson', note: 'Refresh the August 2026 data' },
  phillips: { id: 'r.phillips', title: 'Booklet infographic: Phillips curve and NAIRU' },
} satisfies Record<string, Resource>;

const S = (k: string) => `eco09.hsc.${k}`;
const O = (...codes: string[]) => codes.map((c) => `eco09.hsc.${c}`);

function acts(prefix: string, texts: string[]): Activity[] {
  return texts.map((text, i) => ({ id: `${prefix}.a${i + 1}`, text }));
}

function item(
  id: string,
  kind: Item['kind'],
  code: string,
  title: string,
  opts: {
    share?: string;
    detail?: string;
    activities: string[];
    syllabus: string[];
    outcomes: string[];
    resources?: Resource[];
  },
): Item {
  return {
    id,
    kind,
    code,
    title,
    share: opts.share,
    detail: opts.detail,
    activities: acts(id, opts.activities),
    resources: opts.resources ?? [],
    syllabus: opts.syllabus.map(S),
    outcomes: opts.outcomes,
  };
}

function routines(prefix: string, skillDrill?: string, diagram?: string): Activity[] {
  const list: string[] = ['Data starter: one dated figure from the scorecard or the weekly news summary'];
  if (skillDrill) list.push(`Skill drill (10 minutes): ${skillDrill}`);
  if (diagram) list.push(`Diagram of the block: ${diagram}, referred to in the prose`);
  list.push('Evidence rule: a dated figure in every paragraph');
  return acts(`${prefix}.rt`, list);
}

const LINK_CLOSE = 'Block close: name one conflict this policy creates and file it for Block 7';
const LINK_PARA = 'Two-outcome evaluation question written as an economics paragraph (Point, Explain, Diagram, Evidence, Link and judge)';

const units: Unit[] = [
  {
    id: 'b0',
    code: 'Block 0',
    title: 'Frameworks',
    kind: 'teaching',
    timing: 'Term 1, Weeks 10–11',
    summary: 'Teacher-led: growth, the multiplier and equilibrium were left lessons in 2026.',
    routines: routines('b0', 'equilibrium using leakages and injections; the multiplier', 'AD–AS'),
    items: [
      item('b0.issue', 'part', 'Issue', 'Aggregate demand, equilibrium and the multiplier', {
        detail:
          'AD and Y = C + I + G + (X – M); injections (I + G + X) and withdrawals (S + T + M); equilibrium; simple multiplier k = 1/(1 – MPC); real GDP; business cycle.',
        activities: [
          'AD and Y = C + I + G + (X – M)',
          'Injections, withdrawals and equilibrium',
          'Simple multiplier k = 1/(1 – MPC)',
          'Real GDP and the business cycle',
        ],
        syllabus: ['t3.growth.1', 't3.growth.2'],
        outcomes: O('H1', 'H11'),
        resources: [R.booklet, R.site, R.mdl],
      }),
      item('b0.policy', 'part', 'Policy', 'Objectives and the case for policy', {
        detail:
          'The six economic objectives and potential conflicts; rationale for macroeconomic policy (stabilisation, shifts in AD) and microeconomic policy (shifts in AS, efficiency).',
        activities: [
          'The six economic objectives and potential conflicts',
          'Rationale for macroeconomic policy: stabilisation, shifts in AD',
          'Rationale for microeconomic policy: shifts in AS, efficiency',
          'Sorting task: is each policy an AD or an AS policy?',
        ],
        syllabus: ['t4.obj.1', 't4.obj.2', 't4.obj.3'],
        outcomes: O('H1', 'H5'),
        resources: [R.booklet, R.site],
      }),
      item('b0.check', 'checkpoint', 'Checkpoint', 'Calculation quiz', {
        detail: 'Calculate equilibrium using leakages and injections; multiplier.',
        activities: [
          'Calculate equilibrium using leakages and injections; the multiplier',
          'Short diagnostic for students flagged at the early checkpoint',
          'Peer marking of a paragraph against the band differentiators',
          'Checkpoint: calculation quiz',
        ],
        syllabus: ['t3.skills.1'],
        outcomes: O('H11'),
        resources: [R.calc, R.criteria],
      }),
    ],
  },
  {
    id: 'b1',
    code: 'Block 1',
    title: 'Growth and fiscal policy',
    kind: 'teaching',
    timing: 'Term 2, Weeks 1–3',
    summary: 'Fiscal policy gets two of the three weeks.',
    routines: routines('b1', 'multiplier analysis; interpreting budget data', 'AD–AS'),
    differentiation: [
      { id: 'b1.d1', who: 'Students at B or better', text: 'Extension strand: one issue-by-policy question in 15 minutes with a model response (Section III style this block).' },
    ],
    items: [
      item('b1.issue', 'part', 'Issue', 'Economic growth', {
        share: 'about 40%',
        detail:
          'Sources and effects of growth in Australia; increases in aggregate supply (efficiency, technology); arguments for and against higher growth; business cycle trends.',
        activities: [
          'Sources of growth, including increases in aggregate supply (efficiency, technology)',
          'Effects of growth in Australia',
          'Arguments for and against higher growth',
          'Business cycle trends',
        ],
        syllabus: ['t3.growth.2', 't3.growth.3', 't3.growth.4'],
        outcomes: O('H1', 'H7'),
        resources: [R.site, R.booklet, R.scorecard],
      }),
      item('b1.policy', 'part', 'Policy', 'Fiscal policy', {
        share: 'about 40%',
        detail:
          'Budgets and outcomes; effects on resource use, income distribution and activity; financing deficits; use of a surplus; opportunity cost of government decisions; microeconomic rationale introduced.',
        activities: [
          'Budgets and budget outcomes',
          'Effects on resource use, income distribution and activity',
          'Financing deficits and using a surplus',
          'Opportunity cost of government decisions',
          'Microeconomic rationale introduced',
          'Mechanism as a cause-and-effect chain; effects on other objectives; limits',
        ],
        syllabus: ['t4.fiscal.1', 't4.fiscal.2', 't4.fiscal.3', 't4.obj.3', 't4.limits.1'],
        outcomes: O('H2', 'H5', 'H6'),
        resources: [R.site, R.booklet, R.chain, R.sim],
      }),
      item('b1.link', 'part', 'Link', 'How effective is fiscal policy for growth?', {
        share: 'about 20%',
        activities: [
          LINK_PARA,
          'Fiscal policy question combined with another issue (inflation, distribution or environment)',
          'Issue-by-policy extended response (Section III style)',
          LINK_CLOSE,
        ],
        syllabus: ['t4.fiscal.2', 't3.growth.4', 't4.skills.1'],
        outcomes: O('H5', 'H6', 'H10'),
        resources: [R.erb, R.criteria, R.qf],
      }),
      item('b1.check', 'checkpoint', 'Checkpoint', 'Paired paragraph: fiscal policy and growth', {
        detail: 'Multiplier analysis; interpret budget data.',
        activities: [
          'Multiplier analysis; interpret budget data',
          'Checkpoint: paired paragraph on the effectiveness of fiscal policy for growth',
          'Checked consolidation task (diagram or four-line summary)',
        ],
        syllabus: ['t3.skills.1', 't4.skills.1'],
        outcomes: O('H10', 'H11'),
        resources: [R.calc, R.criteria],
      }),
    ],
  },
  {
    id: 'b2',
    code: 'Block 2',
    title: 'Unemployment and labour market policy',
    kind: 'teaching',
    timing: 'Term 2, Weeks 4–5',
    summary: 'Protected block: a full unit with its own assessed question, revisited in Block 7.',
    routines: routines('b2', 'unemployment and participation rates', 'labour market with a minimum wage; Phillips curve and NAIRU'),
    items: [
      item('b2.issue', 'part', 'Issue', 'Unemployment', {
        share: 'about 40%',
        detail:
          'Labour force, participation and unemployment rates; trends; cyclical, structural, frictional, seasonal, hidden and long-term unemployment; NAIRU; groups affected; economic and social costs.',
        activities: [
          'Labour force, participation and unemployment rates',
          'Unemployment trends',
          'Types: cyclical, structural, frictional, seasonal, hidden and long-term',
          'NAIRU',
          'Groups affected; economic and social costs',
        ],
        syllabus: ['t3.unemp.1', 't3.unemp.2', 't3.unemp.3', 't3.unemp.4'],
        outcomes: O('H1', 'H7', 'H11'),
        resources: [R.site, R.booklet, R.phillips],
      }),
      item('b2.policy', 'part', 'Policy', 'Labour market policy', {
        share: 'about 40%',
        detail:
          'National and state systems, minimum wages, awards, enterprise agreements, dispute resolution; centralised, decentralised and individualised methods; education, training and employment programs.',
        activities: [
          'Teacher-led core: minimum wage, industrial relations, training and job-search programs, effects on aggregate supply',
          'Student-centred work on labour market policy',
          'National and state systems, awards, enterprise agreements and dispute resolution',
          'Centralised, decentralised and individualised wage determination',
          'Education, training and employment programs',
        ],
        syllabus: ['t4.labour.1', 't4.labour.2', 't4.labour.3'],
        outcomes: O('H2', 'H5', 'H6'),
        resources: [R.site, R.booklet, R.mdl],
      }),
      item('b2.link', 'part', 'Link', 'Labour market policy and unemployment', {
        share: 'about 20%',
        activities: [LINK_PARA, 'Issue-by-policy extended response (Section IV style)', LINK_CLOSE],
        syllabus: ['t4.labour.1', 't3.unemp.3', 't4.skills.1'],
        outcomes: O('H5', 'H6', 'H10'),
        resources: [R.erb, R.criteria],
      }),
      item('b2.check', 'checkpoint', 'Checkpoint', 'Calculation quiz and paragraph', {
        activities: [
          'Calculate unemployment and participation rates',
          'Checkpoint: calculation quiz and paragraph',
          'Checked consolidation task before Block 3',
        ],
        syllabus: ['t3.skills.2'],
        outcomes: O('H10', 'H11'),
        resources: [R.calc],
      }),
    ],
  },
  {
    id: 'b3',
    code: 'Block 3',
    title: 'Inflation and monetary policy',
    kind: 'teaching',
    timing: 'Term 2, Weeks 6–7',
    summary: 'Task 3 falls in Week 7.',
    routines: routines('b3', 'AD–AS with a shift in AS', 'AD–AS; Phillips curve'),
    items: [
      item('b3.issue', 'part', 'Issue', 'Inflation', {
        share: 'about 40%',
        detail: 'Headline and underlying measures; trends; demand, cost and imported inflation; expectations; positive and negative effects.',
        activities: [
          'Headline and underlying measures',
          'Inflation trends',
          'Demand, cost and imported inflation; expectations',
          'Positive and negative effects',
        ],
        syllabus: ['t3.infl.1', 't3.infl.2', 't3.infl.3', 't3.infl.4'],
        outcomes: O('H1', 'H7'),
        resources: [R.site, R.booklet, R.scorecard],
      }),
      item('b3.policy', 'part', 'Policy', 'Monetary policy', {
        share: 'about 40%',
        detail:
          'Purpose; RBA implementation; effect of interest rates on activity and the exchange rate; conflicts between price stability and other objectives; supply-side response through microeconomic policy (revisits Block 1).',
        activities: [
          'Purpose of monetary policy and RBA implementation',
          'Effect of interest rates on activity and the exchange rate',
          'Conflicts between price stability and other objectives',
          'Supply-side response through microeconomic policy',
          'Sorting task: is each policy an AD or an AS policy?',
        ],
        syllabus: ['t4.monetary.1', 't4.monetary.2', 't4.obj.2', 't4.micro.1'],
        outcomes: O('H2', 'H5', 'H6'),
        resources: [R.site, R.booklet, R.sim, R.chain],
      }),
      item('b3.link', 'part', 'Link', 'Monetary policy and inflation', {
        share: 'about 20%',
        activities: [
          LINK_PARA,
          'Q27 inflation essay deconstruction lesson',
          'Full assessed question on inflation',
          'Issue-by-policy extended response (Section III style)',
          LINK_CLOSE,
        ],
        syllabus: ['t4.monetary.2', 't3.infl.3', 't4.skills.1'],
        outcomes: O('H5', 'H6', 'H10'),
        resources: [R.q27, R.erb, R.criteria],
      }),
      item('b3.task', 'assessment', 'Task 3', 'Task 3 (Week 7)', {
        detail: 'Stimulus-based extended response, 2026 format; coverage assumed to be Blocks 0 to 3 (to be decided with staff).',
        activities: [
          'Analyse problems facing contemporary and hypothetical economies',
          'Check-in before Task 3 for students flagged at the early checkpoint',
          'Task 3',
        ],
        syllabus: ['t3.skills.5', 't4.skills.1'],
        outcomes: O('H5', 'H6', 'H7', 'H9', 'H10'),
        resources: [R.criteria],
      }),
    ],
  },
  {
    id: 'b4',
    code: 'Block 4',
    title: 'External stability and policy',
    kind: 'teaching',
    timing: 'Term 2, Weeks 8–9',
    summary: 'Builds on Topic 2.',
    routines: routines('b4', 'CAD, net foreign debt and net foreign liabilities ratios; terms of trade index', 'market for the Australian dollar'),
    items: [
      item('b4.issue', 'part', 'Issue', 'External stability', {
        share: 'about 40%',
        detail:
          'CAD, net foreign debt and net foreign liabilities as % of GDP; terms of trade; exchange rate; international competitiveness; trends; effect of a continued CAD.',
        activities: [
          'CAD, net foreign debt and net foreign liabilities as a share of GDP',
          'Terms of trade and the exchange rate',
          'International competitiveness',
          'Trends and the effect of a continued CAD',
        ],
        syllabus: ['t3.ext.1', 't3.ext.2', 't3.ext.3'],
        outcomes: O('H1', 'H4', 'H7'),
        resources: [R.site, R.booklet, R.mdl],
      }),
      item('b4.policy', 'part', 'Policy', 'Policy for external balance', {
        share: 'about 40%',
        detail:
          'Monetary, fiscal (national saving) and microeconomic policy (competition policy, deregulation, labour market reform, reduced protection); global influences as a limitation.',
        activities: [
          'Monetary policy and external balance',
          'Fiscal policy and national saving',
          'Microeconomic policy: competition policy, deregulation, labour market reform, reduced protection',
          'Global influences as a limitation',
        ],
        syllabus: ['t4.monetary.2', 't4.fiscal.2', 't4.micro.2', 't4.limits.1', 't4.limits.2'],
        outcomes: O('H4', 'H5', 'H6'),
        resources: [R.site, R.booklet],
      }),
      item('b4.link', 'part', 'Link', 'Policy and external stability', {
        share: 'about 20%',
        activities: [LINK_PARA, 'Issue-by-policy extended response (Section III style)', LINK_CLOSE],
        syllabus: ['t4.limits.2', 't4.skills.1'],
        outcomes: O('H5', 'H6', 'H10'),
        resources: [R.erb, R.criteria],
      }),
      item('b4.check', 'checkpoint', 'Checkpoint', 'Short-answer set (Q24 style)', {
        activities: [
          'Calculate and interpret the external stability ratios',
          'Assess the key problems facing the economy',
          'Checkpoint: short-answer set in the Q24 style',
        ],
        syllabus: ['t3.skills.3', 't3.skills.5'],
        outcomes: O('H10', 'H11'),
        resources: [R.calc, R.skills],
      }),
    ],
  },
  {
    id: 'b5',
    code: 'Block 5',
    title: 'Distribution of income and wealth',
    kind: 'teaching',
    timing: 'Term 2, Week 10 and Term 3, Week 1',
    routines: routines('b5', 'Lorenz curve and Gini, including the area method', 'Lorenz curve'),
    items: [
      item('b5.issue', 'part', 'Issue', 'Distribution of income and wealth', {
        share: 'about 40%',
        detail:
          'Lorenz curve and Gini; sources of income; taxation, transfers and other assistance; sources of wealth; dimensions and trends by gender, age, occupation, ethnic background and family structure; costs and benefits of inequality.',
        activities: [
          'Lorenz curve and Gini coefficient',
          'Sources of income and wealth',
          'Taxation, transfers and other assistance',
          'Dimensions and trends by gender, age, occupation, ethnic background and family structure',
          'Costs and benefits of inequality',
        ],
        syllabus: ['t3.dist.1', 't3.dist.2', 't3.dist.3', 't3.dist.4'],
        outcomes: O('H1', 'H7', 'H11'),
        resources: [R.site, R.booklet, R.skills],
      }),
      item('b5.policy', 'part', 'Policy', 'Policy and distribution', {
        share: 'about 40%',
        detail: 'Budget effects on income distribution; minimum wages and awards; policy responses for distribution; efficiency–equity trade-off.',
        activities: [
          'Budget effects on income distribution',
          'Minimum wages and awards',
          'Policy responses for distribution',
          'Efficiency–equity trade-off',
          'Revisit fiscal policy combined with distribution',
        ],
        syllabus: ['t4.fiscal.2', 't4.labour.1', 't4.limits.2', 't4.obj.2'],
        outcomes: O('H5', 'H6'),
        resources: [R.site, R.booklet],
      }),
      item('b5.link', 'part', 'Link', 'Policy and inequality', {
        share: 'about 20%',
        activities: [LINK_PARA, 'Issue-by-policy extended response', LINK_CLOSE],
        syllabus: ['t4.skills.1'],
        outcomes: O('H5', 'H6', 'H10'),
        resources: [R.erb, R.criteria],
      }),
      item('b5.check', 'checkpoint', 'Checkpoint', 'Short-answer set (Q23 style)', {
        activities: ['Interpret a Lorenz curve and Gini coefficient', 'Checkpoint: short-answer set in the Q23 style'],
        syllabus: ['t3.skills.4'],
        outcomes: O('H11'),
        resources: [R.skills, R.mdl],
      }),
    ],
  },
  {
    id: 'b6',
    code: 'Block 6',
    title: 'Environmental sustainability and management',
    kind: 'teaching',
    timing: 'Term 3, Weeks 2–3',
    summary: 'Protected block; revisited in the first week of Block 7.',
    routines: routines('b6', 'negative externality (MPB, MPC, MSC)', 'negative externality'),
    items: [
      item('b6.issue', 'part', 'Issue', 'Environmental sustainability', {
        share: 'about 40%',
        detail:
          'ESD; private and social costs and benefits; externalities and market failure; public goods and free riders; pollution, climate change and resource depletion.',
        activities: [
          'Ecologically sustainable development',
          'Private and social costs and benefits; externalities and market failure',
          'Public goods and free riders',
          'Pollution, climate change and resource depletion',
        ],
        syllabus: ['t3.env.1', 't3.env.2', 't3.env.3', 't3.env.4'],
        outcomes: O('H1', 'H7'),
        resources: [R.site, R.booklet, R.mdl],
      }),
      item('b6.policy', 'part', 'Policy', 'Environmental management', {
        share: 'about 40%',
        detail: 'National and global context: regulations, market-based policies, targets, international agreements; limitations.',
        activities: [
          'Regulations and market-based policies',
          'Targets and international agreements',
          'Limitations of environmental policy',
          'Revisit fiscal policy combined with the environment',
        ],
        syllabus: ['t4.envmgmt.1', 't4.envmgmt.2', 't4.limits.1', 't4.fiscal.2'],
        outcomes: O('H5', 'H6'),
        resources: [R.site, R.booklet],
      }),
      item('b6.link', 'part', 'Link', 'Policy and the environment', {
        share: 'about 20%',
        activities: [LINK_PARA, 'Issue-by-policy extended response', LINK_CLOSE],
        syllabus: ['t4.skills.1'],
        outcomes: O('H5', 'H6', 'H10'),
        resources: [R.erb, R.criteria],
      }),
      item('b6.check', 'checkpoint', 'Checkpoint', 'Q21-style short answer and an extended paragraph', {
        activities: ['Analyse a contemporary environmental issue', 'Checkpoint: short answer in the Q21 style and an extended paragraph'],
        syllabus: ['t3.skills.5'],
        outcomes: O('H7', 'H10'),
        resources: [R.criteria],
      }),
    ],
  },
  {
    id: 'trial',
    code: 'Trial',
    title: 'Trial HSC',
    kind: 'assessment',
    timing: 'Term 3, Weeks 4–5',
    items: [
      item('trial.exam', 'assessment', 'Trial', 'Trial HSC examination (whole course)', {
        activities: ['Trial HSC examination'],
        syllabus: [],
        outcomes: [],
      }),
    ],
  },
  {
    id: 'b7',
    code: 'Block 7',
    title: 'Policy mix and integration',
    kind: 'teaching',
    timing: 'Term 3, Weeks 6–7 (after the Trial)',
    summary: 'Revisits environment, labour market policy and fiscal policy; re-teaches from the Trial results.',
    routines: routines('b7'),
    items: [
      item('b7.issue', 'part', 'Issue', 'The key problems facing the Australian economy', {
        activities: [
          'Assess the key problems facing the Australian economy',
          'Revisit environment with the policy mix (first week)',
        ],
        syllabus: ['t3.skills.5'],
        outcomes: O('H7'),
        resources: [R.scorecard, R.news],
      }),
      item('b7.policy', 'part', 'Policy', 'Conflicts, limitations and the policy mix', {
        detail:
          'Conflicts among objectives; limitations (time lags, global influences, political constraints); selecting a policy mix; policy responses to all six objectives; proposing and evaluating alternatives.',
        activities: [
          'Conflicts among objectives, using the conflicts filed in each block',
          'Limitations: time lags, global influences, political constraints',
          'Selecting a policy mix; policy responses to all six objectives',
          'Proposing and evaluating alternatives',
          'Revisit fiscal policy and labour market policy',
        ],
        syllabus: ['t4.obj.2', 't4.limits.1', 't4.limits.2', 't4.limits.3'],
        outcomes: O('H5', 'H6'),
        resources: [R.site, R.sim],
      }),
      item('b7.integrate', 'part', 'Integration', 'Extended responses and re-teaching', {
        activities: [
          'Integrated extended responses',
          'Re-teach from Trial results using the band differentiators and caps',
          'Gap analysis before the HSC',
        ],
        syllabus: ['t4.skills.1'],
        outcomes: O('H9', 'H10'),
        resources: [R.erb, R.qf, R.criteria],
      }),
    ],
  },
  {
    id: 'rev',
    code: 'Revision',
    title: 'Revision',
    kind: 'revision',
    timing: 'Term 3, Weeks 8–10',
    items: [
      item('rev.1', 'part', 'Revision', 'Whole-course revision', {
        activities: ['Revision'],
        syllabus: [],
        outcomes: [],
        resources: [R.mcd, R.qf, R.gloss],
      }),
    ],
  },
];

export const ecoT34Program: Program = {
  id: 'eco-hsc-t34-2027',
  title: 'HSC Economics Topics 3 & 4 — 2027 parallel program',
  subject: 'Economics',
  syllabusId: 'eco09',
  courseId: 'eco09.hsc',
  year: 2027,
  version: 1,
  structure: 'blocks',
  summary:
    'Each Topic 3 issue is taught with the Topic 4 policy response that addresses it, over 17 teaching weeks from Term 1 Week 10 to Term 3 Week 7, around Task 3 (Term 2 Week 7) and the Trial (Term 3 Weeks 4–5).',
  source: {
    title: 'HSC Economics Topics 3 & 4 — 2027 Prospective Program (parallel model)',
    url: 'https://claude.ai/artifact/DJqSFWg6XqrsmiDEX9qMws',
  },
  differentiation: [
    {
      id: 'p.d1',
      who: 'Students below about 60% on AT1 and AT2 combined',
      text: 'Early checkpoint after the Topic 2 test: short diagnostic in Block 0, a weekly extended-response paragraph with feedback, and a check-in before Task 3.',
    },
    {
      id: 'p.d2',
      who: 'Students at B or better',
      text: 'Extended-response extension strand, Blocks 1 to 7: one issue-by-policy question in 15 minutes per block with a model response; Section III style in Blocks 1, 3 and 4.',
    },
    {
      id: 'p.d3',
      who: 'All students',
      text: 'A short, checked consolidation task for every issue–policy pair (a diagram or a four-line summary), reviewed in the first five minutes of the next lesson.',
    },
    {
      id: 'p.d4',
      who: 'All students',
      text: 'Peer marking of paragraphs against the band differentiators, fortnightly from Block 0.',
    },
  ],
  resources: Object.values(R),
  units,
};
