import type { LedgerCategory, ProgramEconomy } from "./models";

export function createInitialEconomy(): ProgramEconomy {
  return {
    cash: 125_000,
    contractCostPerWeek: 3_500,
    trainingSpend: 0,
    travelSpend: 0,
    prizeIncome: 0,
    ledger: [
      {
        id: "ledger-2026-06-01-sponsor",
        date: "2026-06-01",
        category: "sponsor",
        label: "Season operating grant",
        amount: 125_000,
        balanceAfter: 125_000
      }
    ]
  };
}

export function addLedgerEntry(args: {
  economy: ProgramEconomy;
  date: string;
  category: LedgerCategory;
  label: string;
  amount: number;
}) {
  const balanceAfter = args.economy.cash + args.amount;
  const entry = {
    id: `ledger-${args.date}-${args.category}-${args.economy.ledger.length + 1}`,
    date: args.date,
    category: args.category,
    label: args.label,
    amount: Math.round(args.amount),
    balanceAfter: Math.round(balanceAfter)
  };

  return {
    ...args.economy,
    cash: entry.balanceAfter,
    ledger: [...args.economy.ledger, entry]
  };
}

export function eventEntryCost(args: { travelCost: number; entryFee: number }) {
  return args.travelCost + args.entryFee;
}

export function canAffordEventEntry(args: {
  economy: ProgramEconomy;
  travelCost: number;
  entryFee: number;
}) {
  return args.economy.cash >= eventEntryCost(args);
}

export function chargeEventEntry(args: {
  economy: ProgramEconomy;
  date: string;
  label: string;
  travelCost: number;
  entryFee: number;
}) {
  if (!canAffordEventEntry(args)) {
    return args.economy;
  }

  const withTravel = addLedgerEntry({
    economy: args.economy,
    date: args.date,
    category: "travel",
    label: `${args.label} travel`,
    amount: -args.travelCost
  });
  const withEntry = addLedgerEntry({
    economy: withTravel,
    date: args.date,
    category: "entry",
    label: `${args.label} entry`,
    amount: -args.entryFee
  });

  return {
    ...withEntry,
    travelSpend: withEntry.travelSpend + args.travelCost
  };
}

export function recordPrizeMoney(args: {
  economy: ProgramEconomy;
  date: string;
  label: string;
  amount: number;
}) {
  const next = addLedgerEntry({
    economy: args.economy,
    date: args.date,
    category: "prize",
    label: args.label,
    amount: args.amount
  });

  return {
    ...next,
    prizeIncome: next.prizeIncome + args.amount
  };
}
