import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyMessageOf,
  issueGroupsOf,
  issuesInView,
  ruleNameOf,
  type Issue,
} from "../src/issue-model.js";

const issue = (rule: string, start: number): Issue => ({
  rule,
  message: "m",
  quote: "q",
  start,
  end: start + 5,
});

const issues = [
  issue("no-passive-sentences", 40),
  issue("no-explained-intensifiers", 0),
  issue("no-explained-intensifiers", 100),
  issue("no-explained-intensifiers", 20),
];

describe("issuesInView", () => {
  it("keeps the issues in any visible range, in document order, once", () => {
    assert.deepEqual(
      issuesInView(issues, [
        { start: 15, end: 45 },
        { start: 30, end: 50 },
      ]).map(({ start }) => start),
      [20, 40],
    );
  });
});

describe("issueGroupsOf", () => {
  it("puts the rule with most issues first, each group in document order", () => {
    const groups = issueGroupsOf(issues);
    assert.deepEqual(
      groups.map(({ rule, issues: members }) => [
        rule,
        members.map(({ start }) => start),
      ]),
      [
        ["no-explained-intensifiers", [0, 20, 100]],
        ["no-passive-sentences", [40]],
      ],
    );
  });

  it("names rules from the catalog", () => {
    assert.notEqual(ruleNameOf("no-passive-sentences"), "no-passive-sentences");
    assert.equal(ruleNameOf("unknown-rule"), "unknown-rule");
  });
});

describe("emptyMessageOf", () => {
  it("explains an empty list", () => {
    assert.equal(emptyMessageOf("byType", 0, 0), "No issues in this file.");
    assert.equal(
      emptyMessageOf("inView", 3, 0),
      "No issues in view. 3 issues elsewhere in the file.",
    );
    assert.equal(emptyMessageOf("inView", 3, 1), undefined);
  });
});
