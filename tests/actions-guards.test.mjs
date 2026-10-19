import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/lib/actions.ts", import.meta.url), "utf8");

function exportedActions(text) {
  const matches = [...text.matchAll(/export async function (\w+)/g)];
  return matches.map((match, index) => ({
    name: match[1],
    body: text.slice(match.index, matches[index + 1]?.index ?? text.length),
  }));
}

test("every server action requires authorization", () => {
  for (const action of exportedActions(source)) {
    assert.match(action.body, /await requireAuthorization\(\)/, action.name);
  }
});

test("built-in owner and category cannot be updated", () => {
  assert.match(source, /UPDATE owners[\s\S]*lower\(name\) <> 'unassigned'/);
  assert.match(source, /UPDATE categories[\s\S]*slug <> 'uncategorized'/);
});

test("owner and category deletion is transactional and does not reset sequences", () => {
  assert.doesNotMatch(source, /setval\(/);
  for (const name of ["deleteOwner", "deleteCategory"]) {
    const action = exportedActions(source).find((candidate) => candidate.name === name);
    assert.ok(action, name);
    assert.match(action.body, /await withTransaction/, name);
    assert.match(action.body, /FOR UPDATE/, name);
    assert.equal(action.body.match(/await client\.query/g)?.length, 3, name);
  }
});
