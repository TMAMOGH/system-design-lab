import type { Scenario } from "../engine/core/types";
import { readHeavy } from "./readHeavy";

/** Prediction-exercise variant (§10.2): write your prediction before running it. */
export const readHeavyVariant: Scenario = {
  ...readHeavy,
  id: "read-heavy-variant",
  title: "Scale a write-heavier app",
  readRatio: 0.7,
  zipfS: 0.7,
  keyspace: 1_000_000,
  budgetPerHour: 3.0,
};
