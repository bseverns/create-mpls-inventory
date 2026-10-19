import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorized, unauthorizedResponse } from "../src/lib/auth.mjs";

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("authorization is denied when credentials are not configured", () => {
  assert.equal(isAuthorized(new Headers(), {}), false);
});

test("authorization accepts only the configured credentials", () => {
  const environment = { INVENTORY_USERNAME: "admin", INVENTORY_PASSWORD: "secret:part" };

  assert.equal(isAuthorized(new Headers({ authorization: basic("admin", "wrong") }), environment), false);
  assert.equal(isAuthorized(new Headers({ authorization: basic("admin", "secret:part") }), environment), true);
  assert.equal(
    isAuthorized(
      new Headers({ authorization: basic("admin", "secret:part").replace("Basic", "bAsIc") }),
      environment,
    ),
    true,
  );
  assert.equal(
    isAuthorized(new Headers({ authorization: basic("créate", "🔒") }), {
      INVENTORY_USERNAME: "créate",
      INVENTORY_PASSWORD: "🔒",
    }),
    true,
  );
});

test("malformed authorization is denied", () => {
  const environment = { INVENTORY_USERNAME: "admin", INVENTORY_PASSWORD: "secret" };
  assert.equal(isAuthorized(new Headers({ authorization: "Bearer token" }), environment), false);
  assert.equal(isAuthorized(new Headers({ authorization: "Basic not-base64!" }), environment), false);
  assert.equal(isAuthorized(new Headers({ authorization: basic("missing-colon", "").slice(0, -4) }), environment), false);
  assert.equal(
    isAuthorized(
      new Headers({
        authorization: `Basic ${Buffer.concat([Buffer.from("admin:"), Buffer.from([0xff])]).toString("base64")}`,
      }),
      { INVENTORY_USERNAME: "admin", INVENTORY_PASSWORD: "�" },
    ),
    false,
  );
});

test("unauthorized responses challenge the browser", () => {
  const response = unauthorizedResponse();

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), 'Basic realm="createMPLS Inventory", charset="UTF-8"');
});
